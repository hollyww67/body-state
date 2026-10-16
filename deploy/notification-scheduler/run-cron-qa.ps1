$ErrorActionPreference = 'Stop'
$image = 'notification-scheduler-cron-qa:local'
$name = 'notification-scheduler-cron-qa-' + [guid]::NewGuid().ToString('N').Substring(0,12)
docker --context default build -f deploy/notification-scheduler/Dockerfile.cron-qa -t $image .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker --context default run --name $name --network none $image
exit $LASTEXITCODE
