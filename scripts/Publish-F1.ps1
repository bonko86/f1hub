param(
    [string]$SshTarget = 'codex-f1@192.168.1.105',
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\codex_f1"
)
$ErrorActionPreference = 'Stop'
if ($SshTarget -notmatch '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+$') { throw 'Invalid SSH target' }
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $dirty = @(git status --porcelain -- client server shared package.json package-lock.json tsconfig.json tsconfig.server.json vite.config.ts scripts/dev.mjs)
    if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'Application source must be committed before publishing. No automatic commit or push is performed.' }
    $revision = (git rev-parse HEAD).Trim()
    $remote = (git ls-remote origin refs/heads/main)
    if ($LASTEXITCODE -ne 0 -or !$remote -or ($remote -split '\s+')[0] -ne $revision) { throw 'Local HEAD must match GitHub main before publishing.' }
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    $sshOptions = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
    & ssh @sshOptions $SshTarget 'sudo -n -l /usr/local/sbin/deploy-f1-hubb'
    if ($LASTEXITCODE -ne 0) { throw 'Protected deployment helper is not enabled, or SSH key is locked.' }
    $archivePath = Join-Path ([IO.Path]::GetTempPath()) ('f1-hubb-' + [guid]::NewGuid().ToString('N') + '.tar')
    git archive --format=tar --output=$archivePath HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Archive failed' }
    $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $remoteTemporary = (& ssh @sshOptions $SshTarget 'mktemp -d /tmp/f1-hubb-upload.XXXXXXXX').Trim()
    if ($LASTEXITCODE -ne 0 -or $remoteTemporary -notmatch '^/tmp/f1-hubb-upload\.[a-zA-Z0-9]+$') { throw 'Invalid remote temporary directory' }
    & scp @sshOptions $archivePath "${SshTarget}:${remoteTemporary}/source.tar"
    if ($LASTEXITCODE -ne 0) { throw 'Source transfer failed' }
    & scp @sshOptions (Join-Path $projectRoot 'deploy/production/stage.py') "${SshTarget}:${remoteTemporary}/stage.py"
    if ($LASTEXITCODE -ne 0) { throw 'Staging helper transfer failed' }
    $remoteHash = (& ssh @sshOptions $SshTarget "sha256sum $remoteTemporary/source.tar")
    if ($LASTEXITCODE -ne 0 -or ($remoteHash -split '\s+')[0] -ne $hash) { throw 'Source checksum mismatch' }
    & ssh @sshOptions $SshTarget "/usr/bin/python3 -I $remoteTemporary/stage.py $remoteTemporary/source.tar $revision"
    if ($LASTEXITCODE -ne 0) { throw 'Source staging failed' }
    Write-Host "Publishing GitHub main at $revision. Only F1 will be rebuilt and recreated; data volumes are preserved."
    & ssh @sshOptions $SshTarget 'sudo -n /usr/local/sbin/deploy-f1-hubb'
    if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. No automatic rollback was performed; inspect with status-f1-hubb.' }
    Write-Host 'Deployment verified. Nginx Proxy Manager, DNS and certificates were not changed.'
    Remove-Item -LiteralPath $archivePath
} finally { Pop-Location }
