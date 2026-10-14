<#
.SYNOPSIS
  Test, build and publish Steady to the Apache server, then tag the release in git.
  Uses the OpenSSH client built into Windows. See the Deploy section of README.md.

.EXAMPLE
  ./deploy/deploy.ps1 -Server 203.0.113.10 -KeyFile $HOME\.ssh\id_ed25519
  ./deploy/deploy.ps1 -Server 203.0.113.10 -KeyFile $HOME\.ssh\id_ed25519 -Release 2026-09-30-2
#>
param(
  [Parameter(Mandatory = $true)] [string] $Server,
  [string] $User = 'root',
  [string] $KeyFile,
  [string] $Release = (Get-Date -Format 'yyyy-MM-dd'),
  [string] $RemoteRoot = '/var/www/steady',
  [switch] $SkipTests,
  [switch] $NoTag
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$sshArgs = @()
if ($KeyFile) { $sshArgs = @('-i', $KeyFile) }

# Releases should match committed code, so the git tag points at exactly what's live.
$dirty = git status --porcelain
if ($dirty -and -not $NoTag) {
  throw "You have uncommitted changes. Commit them first (see docs/WORKFLOW.md), or pass -NoTag to deploy without tagging."
}
if (-not $NoTag -and (git tag --list "release-$Release")) {
  throw "Tag release-$Release already exists. Use -Release $Release-2 for a second release today."
}

if (-not $SkipTests) {
  Write-Host '==> Unit tests' -ForegroundColor Cyan
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed - not deploying.' }
}

Write-Host '==> Production build' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed - not deploying.' }

$archive = Join-Path $env:TEMP "steady-$Release.tar.gz"
Write-Host "==> Packing release $Release" -ForegroundColor Cyan
tar -czf $archive -C dist .

$target = "$User@$Server"
Write-Host "==> Uploading to $target" -ForegroundColor Cyan
scp @sshArgs $archive "${target}:/tmp/steady-$Release.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }

# Unpack into a fresh release folder and switch the symlink atomically; keep the 5 newest releases.
$remote = @"
set -e
if [ -e $RemoteRoot/releases/$Release ]; then echo "Release folder $Release already exists" >&2; exit 1; fi
mkdir -p $RemoteRoot/releases/$Release
tar -xzf /tmp/steady-$Release.tar.gz -C $RemoteRoot/releases/$Release
rm /tmp/steady-$Release.tar.gz
ln -sfn $RemoteRoot/releases/$Release $RemoteRoot/current
cd $RemoteRoot/releases && ls -1t | tail -n +6 | xargs -r rm -rf
echo "Live: release $Release"
"@
ssh @sshArgs $target $remote.Replace("`r", '')
if ($LASTEXITCODE -ne 0) { throw 'Remote activation failed.' }
Remove-Item $archive

if (-not $NoTag) {
  Write-Host "==> Tagging release-$Release" -ForegroundColor Cyan
  git tag "release-$Release"
  git push origin "release-$Release"
}

Write-Host "==> Deployed $Release. Add a CHANGELOG.md entry and tick items off in BUGS.md." -ForegroundColor Green
