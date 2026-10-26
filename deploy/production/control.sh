#!/bin/bash -p
set -Eeuo pipefail
umask 077
cd /
STATE=/var/lib/f1-hubb-deploy
CONFIG=/etc/f1-hubb/compose.yaml
DOCKER=/usr/bin/docker
export F1_BUILD_CONTEXT="$STATE"
export F1_IMAGE=f1-hubb:current
exec 9>"$STATE/deploy.lock"
/usr/bin/flock -n 9 || { echo 'Another F1 operation is running'; exit 1; }
compose() { "$DOCKER" compose --env-file /dev/null --project-directory /etc/f1-hubb -p f1-hubb -f "$CONFIG" "$@"; }
inventory() {
  /usr/bin/python3 -I -c 'import subprocess,json; ids=subprocess.check_output(["/usr/bin/docker","ps","-aq"],text=True).split(); rows=json.loads(subprocess.check_output(["/usr/bin/docker","inspect",*ids],text=True)) if ids else []; print(json.dumps(sorted([(r["Id"],r["State"]["StartedAt"],r["RestartCount"]) for r in rows if r["Name"]!="/f1-hubb"])))'
}
verify() {
  for attempt in {1..60}; do
    health=$("$DOCKER" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' f1-hubb)
    if [[ "$health" == healthy ]]; then break; fi
    if [[ "$health" == unhealthy ]]; then echo 'F1 is unhealthy'; return 1; fi
    /usr/bin/sleep 2
  done
  [[ "$health" == healthy ]] || { echo 'Timed out waiting for healthy'; return 1; }
  "$DOCKER" exec -i -e "F1_VERIFY_TOKEN=$(cat "$STATE/persistence-token")" -e "F1_EXPECT_PERSISTENCE=$expect_persistence" f1-hubb node --input-type=commonjs < /etc/f1-hubb/verify.cjs
}
trap 'echo "F1 operation failed; no automatic rollback or data deletion was performed." >&2' ERR
if "$DOCKER" container inspect f1-hubb >/dev/null 2>&1; then
  project=$("$DOCKER" inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' f1-hubb)
  service=$("$DOCKER" inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' f1-hubb)
  [[ "$project" == f1-hubb && "$service" == f1 ]] || { echo 'Container name belongs to another project/service; refusing'; exit 1; }
fi
case "${1:-}" in
  status)
    compose ps -a f1
    if "$DOCKER" container inspect f1-hubb >/dev/null 2>&1; then
      "$DOCKER" inspect --format 'Image={{.Image}} State={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}} Restarts={{.RestartCount}} Mounts={{json .Mounts}} Networks={{json .NetworkSettings.Networks}}' f1-hubb
      "$DOCKER" exec f1-hubb node -e 'Promise.all(["/api/health","/api/dashboard","/api/live"].map(async p=>{const r=await fetch("http://127.0.0.1:3000"+p);const d=await r.json();console.log(JSON.stringify({endpoint:p,status:r.status,loading:d.loading,races:d.calendar?.length,drivers:d.drivers?.length,constructors:d.constructors?.length,liveStatus:p==="/api/live"?d.status:undefined,updated:d.updated,errors:d.errors}));})).catch(()=>process.exit(1))'
      "$DOCKER" logs --tail 30 f1-hubb
    fi
    ;;
  deploy|rollback)
    inventory > "$STATE/other-containers-before.json"
    "$DOCKER" network inspect proxy-net >/dev/null
    if [[ ! -e "$STATE/persistence-token" ]]; then
      /usr/bin/python3 -I -c 'import secrets; print(secrets.token_hex(24))' > "$STATE/persistence-token"
    fi
    if [[ -e "$STATE/persistence-verified" ]]; then expect_persistence=yes; else expect_persistence=no; fi
    if [[ "$1" == deploy ]]; then
      /usr/bin/install -d -m 0700 "$STATE/releases"
      release=$(/usr/bin/mktemp -d "$STATE/releases/release.XXXXXXXX")
      /usr/bin/python3 -I /etc/f1-hubb/snapshot.py "$release/source"
      export F1_BUILD_CONTEXT="$release/source"
      compose config --quiet
      compose build f1
      if "$DOCKER" container inspect f1-hubb >/dev/null 2>&1; then
        "$DOCKER" inspect --format '{{.Image}}' f1-hubb > "$STATE/previous-image"
      fi
    else
      [[ -s "$STATE/previous-image" ]] || { echo 'No previous F1 image available'; exit 1; }
      export F1_IMAGE="$(cat "$STATE/previous-image")"
      [[ "$F1_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
      "$DOCKER" image inspect "$F1_IMAGE" >/dev/null
      compose config --quiet
    fi
    if [[ $("$DOCKER" inspect --format '{{.State.Running}}' f1-hubb 2>/dev/null || true) == true ]]; then
      backup="/app/backups/pre-$1-$(/usr/bin/date -u +%Y%m%dT%H%M%SZ).sqlite"
      "$DOCKER" exec f1-hubb node dist/server/backup.js "$backup"
    fi
    compose up -d --no-deps --no-build f1
    verify
    /usr/bin/touch "$STATE/persistence-verified"
    inventory > "$STATE/other-containers-after.json"
    /usr/bin/cmp "$STATE/other-containers-before.json" "$STATE/other-containers-after.json" || { echo 'Other container state changed during deployment; investigate'; exit 1; }
    echo 'F1 verified. Other container IDs, start times and restart counts unchanged.'
    if [[ "$1" == deploy ]]; then /usr/bin/cp "$F1_BUILD_CONTEXT/.source-commit" "$STATE/current-source-commit"; fi
    ;;
  *) echo 'Invalid protected operation'; exit 1 ;;
esac
