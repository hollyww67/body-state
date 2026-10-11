#!/usr/bin/env sh
set -eu

TASK="${1:-}"
case "$TASK" in
  reminders|auto-complete|cancel-pending|extend-schedule) ;;
  *) echo "Unknown cron task" >&2; exit 2 ;;
esac

PROJECT_DIR="${DOCTOR_SITE_DIR:-/opt/doctor-site}"
ENV_FILE="$PROJECT_DIR/.env.production"
SECRET="$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')"
test -n "$SECRET" || { echo "CRON_SECRET is missing" >&2; exit 1; }

curl --fail --silent --show-error \
  -H "Authorization: Bearer $SECRET" \
  "http://127.0.0.1:3000/api/cron/$TASK"
