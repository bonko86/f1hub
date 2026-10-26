"""Unprivileged staging only. Never touches /opt/f1-hubb/data or Docker."""
import os
import pathlib
import re
import sys
import tarfile
import uuid

if os.getuid() != 1001:
    raise SystemExit('Run as codex-f1, never as root')
archive = pathlib.Path(sys.argv[1])
revision = sys.argv[2]
if not re.fullmatch('[a-f0-9]{40}', revision):
    raise SystemExit('Invalid source revision')
app = pathlib.Path('/opt/f1-hubb')
if app.is_symlink() or app.stat().st_uid != 1001:
    raise SystemExit('Unexpected application directory')
with tarfile.open(archive) as bundle:
    members = bundle.getmembers()
    if len(members) > 5000 or sum(m.size for m in members) > 100 * 1024 * 1024:
        raise SystemExit('Archive too large')
    seen = set()
    for m in members:
        p = pathlib.PurePosixPath(m.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or m.name in seen or not (m.isdir() or m.isfile()):
            raise SystemExit('Unsafe archive member')
        if any(part in {'.git', '.env', 'data', 'backups', 'node_modules', 'dist', '.ssh', '.aws', '.playwright-mcp'} for part in p.parts):
            raise SystemExit('Generated or private content in archive')
        seen.add(m.name)
    staged = app / ('staging-' + uuid.uuid4().hex)
    staged.mkdir(mode=0o700)
    for m in members:
        target = staged / m.name
        if m.isdir():
            target.mkdir(parents=True, exist_ok=True, mode=0o700)
        else:
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with bundle.extractfile(m) as src, target.open('xb') as out:
                while chunk := src.read(65536):
                    out.write(chunk)
            target.chmod(0o600)
    (staged / '.source-commit').write_text(revision + '\n', encoding='utf-8')
    for name in ('package.json', 'package-lock.json', 'client', 'server', 'shared'):
        if not (staged / name).exists():
            raise SystemExit('Incomplete source archive')
    current = app / 'source'
    if current.is_symlink():
        raise SystemExit('Source may not be a symlink')
    if current.exists():
        history = app / 'source-history'
        if history.is_symlink():
            raise SystemExit('History may not be a symlink')
        history.mkdir(exist_ok=True, mode=0o700)
        current.rename(history / uuid.uuid4().hex)
    staged.rename(current)
print('Clean source staged; production data untouched')
