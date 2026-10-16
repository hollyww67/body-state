#!/bin/sh
# Run from repository root; CI exit code is the test container exit code.
set -eu
image=notification-scheduler-cron-qa:local
name=notification-scheduler-cron-qa-$$
docker --context default build -f deploy/notification-scheduler/Dockerfile.cron-qa -t "$image" .
docker --context default run --name "$name" --network none "$image"
# Container/evidence intentionally retained; docker logs NAME and docker cp NAME:/qa/evidence DEST.
