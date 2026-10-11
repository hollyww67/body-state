$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $projectRoot "doctor-site-deploy-$stamp.tar.gz"

tar -czf $archive `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=.git `
  --exclude=.env `
  --exclude=.env.local `
  --exclude=.env.production `
  --exclude=artifacts `
  --exclude=backups `
  --exclude=.docker-test-uploads `
  --exclude=.audit `
  --exclude=audit `
  --exclude=release-audit `
  --exclude=mobile `
  --exclude=scripts/ssh-askpass.cmd `
  --exclude=scripts/audit-production.sh `
  --exclude=scripts/audit-production-detail.sh `
  --exclude=scripts/audit-mail-server.sh `
  --exclude=scripts/test-mail-auth.sh `
  --exclude=scripts/inspect-mail-credentials-format.sh `
  --exclude=scripts/send-mail-smoke.sh `
  --exclude=scripts/update-production-smtp.sh `
  --exclude=scripts/inspect-production-storage.sh `
  --exclude='*.tar' `
  --exclude='*.tar.gz' `
  --exclude='*.log' `
  -C $projectRoot .

if ($LASTEXITCODE -ne 0) {
  throw "Failed to create deployment archive"
}

Write-Output "Created: $archive"
Write-Output "Upload:  scp `"$archive`" root@SERVER_IP:/tmp/doctor-site.tar.gz"
