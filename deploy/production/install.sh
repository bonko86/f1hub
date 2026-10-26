#!/bin/bash -p
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run with sudo from the administrator account'; exit 1; }
SOURCE=$(cd -- "$(dirname -- "$0")" && pwd -P)
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV PYTHONPATH PYTHONHOME
cd /
for file in compose.yaml snapshot.py verify.cjs control.sh deploy-f1-hubb status-f1-hubb rollback-f1-hubb sudoers; do
  [[ -f "$SOURCE/$file" && ! -L "$SOURCE/$file" ]] || exit 1
done
id codex-f1 | /usr/bin/grep -q 'uid=1001(codex-f1)' || exit 1
/usr/sbin/visudo -cf "$SOURCE/sudoers"
for file in control.sh deploy-f1-hubb status-f1-hubb rollback-f1-hubb; do /bin/bash -n "$SOURCE/$file"; done
/usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/root LANG=C.UTF-8 F1_BUILD_CONTEXT=/var/lib/f1-hubb-deploy /usr/bin/docker compose --env-file /dev/null --project-directory /etc/f1-hubb -p f1-hubb -f "$SOURCE/compose.yaml" config --quiet
/usr/bin/install -d -o root -g root -m 0700 /var/lib/f1-hubb-deploy
backup=$(/usr/bin/mktemp -d /var/lib/f1-hubb-deploy/admin-backup.XXXXXXXX)
/usr/bin/cp -a /etc/f1-hubb/compose.yaml "$backup/compose.yaml"
/usr/bin/cp -a /usr/local/sbin/deploy-f1-hubb "$backup/deploy-f1-hubb"
if [[ -f /etc/sudoers.d/codex-f1-hubb ]]; then /usr/bin/cp -a /etc/sudoers.d/codex-f1-hubb "$backup/sudoers"; fi
for file in compose.yaml snapshot.py verify.cjs control.sh; do /usr/bin/install -o root -g root -m 0600 "$SOURCE/$file" "/etc/f1-hubb/$file"; done
for file in deploy-f1-hubb status-f1-hubb rollback-f1-hubb; do /usr/bin/install -o root -g root -m 0700 "$SOURCE/$file" "/usr/local/sbin/$file"; done
/usr/bin/install -o root -g root -m 0440 "$SOURCE/sudoers" /etc/sudoers.d/codex-f1-hubb
/usr/sbin/visudo -cf /etc/sudoers.d/codex-f1-hubb
/usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/root LANG=C.UTF-8 F1_BUILD_CONTEXT=/var/lib/f1-hubb-deploy /usr/bin/docker compose --env-file /dev/null --project-directory /etc/f1-hubb -p f1-hubb -f /etc/f1-hubb/compose.yaml config --quiet
echo "Installed only F1 helpers and F1 sudoers. Original configuration saved in $backup. No deployment or container restart was performed."
