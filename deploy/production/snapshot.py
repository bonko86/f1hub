"""Root-installed helper: archive as codex-f1, validate, extract into a new root-only directory."""
import os
import pathlib
import resource
import subprocess
import sys
import tarfile

destination = pathlib.Path(sys.argv[1])
parent = pathlib.Path('/var/lib/f1-hubb-deploy/releases').resolve()
if destination.parent.parent.resolve() != parent or destination.name != 'source' or destination.exists():
    raise SystemExit('Invalid snapshot destination')
source = pathlib.Path('/opt/f1-hubb/source')
if source.is_symlink() or source.stat().st_uid != 1001:
    raise SystemExit('Unexpected application directory owner or symlink')
files = ['.source-commit', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.server.json', 'vite.config.ts', 'client', 'server', 'shared', 'scripts']
archive = destination.parent / 'source.tar'
with archive.open('xb') as output:
    subprocess.run(['/usr/sbin/runuser', '-u', 'codex-f1', '--', '/usr/bin/tar', '-C', str(source), '-cf', '-', '--', *files], stdout=output, check=True, timeout=60, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}, preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (100 * 1024 * 1024, 100 * 1024 * 1024)))
if archive.stat().st_size > 100 * 1024 * 1024:
    raise SystemExit('Source archive exceeds 100 MiB')
blocked = {'.env', '.git', '.ssh', '.aws', '.agents', '.codex', 'node_modules', 'dist', 'data', 'backups', '.playwright-mcp'}
seen = set()
with tarfile.open(archive) as bundle:
    members = bundle.getmembers()
    if len(members) > 5000 or sum(m.size for m in members) > 100 * 1024 * 1024:
        raise SystemExit('Too many or too large source files')
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] not in files:
            raise SystemExit('Invalid archive path')
        if not (member.isdir() or member.isfile()) or member.name in seen:
            raise SystemExit('Links, special files and duplicate paths are prohibited')
        if any(p in blocked or p.startswith('.env') for p in path.parts) or path.suffix in {'.sqlite', '.db', '.pem', '.key', '.log'}:
            raise SystemExit('Private or generated file in build input')
        seen.add(member.name)
    destination.mkdir(mode=0o700)
    for member in members:
        target = destination / member.name
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True, mode=0o700)
        else:
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with bundle.extractfile(member) as src, target.open('xb') as out:
                while chunk := src.read(65536):
                    out.write(chunk)
            target.chmod(0o600)
# Do not accept a user-controlled Docker ignore file or Dockerfile in the build context.
(destination / '.dockerignore').write_text('.git\n.env\nnode_modules\ndist\ndata\nbackups\n*.log\n', encoding='utf-8')
print(destination)
