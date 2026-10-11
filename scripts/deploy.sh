#!/usr/bin/env sh
set -eu

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Run: node scripts/create-production-env.mjs your-domain.ru"
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker run --rm --env-file "$ENV_FILE" -v "$PWD:/app:ro" -w /app node:24-alpine node scripts/validate-production-env.mjs
UPLOADS_PATH="$(awk -F= '/^UPLOADS_DIR=/{sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE" | tr -d '\r')"
UPLOADS_PATH="${UPLOADS_PATH:-/var/www/doctor-site-uploads}"
case "$UPLOADS_PATH" in
  /*) ;;
  *) echo "UPLOADS_DIR must be an absolute path"; exit 1 ;;
esac
mkdir -p "$UPLOADS_PATH/media/images" "$UPLOADS_PATH/media/videos"
# The application container runs as UID/GID 1001. A bind mount keeps host
# ownership, so checking writability as root would incorrectly pass while every
# upload fails with EACCES inside the container.
chown -R 1001:1001 "$UPLOADS_PATH"
if [ "$(stat -c %u "$UPLOADS_PATH")" != "1001" ]; then
  echo "Uploads directory must be owned by UID 1001: $UPLOADS_PATH"
  exit 1
fi
if [ -n "$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null)" ]; then
  mkdir -p backups
  BACKUP_FILE="backups/doctor-site-$(date +%Y%m%d-%H%M%S).dump"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U doctor_site -d doctor_site -Fc > "$BACKUP_FILE"
  test -s "$BACKUP_FILE" || { echo "Database backup failed"; exit 1; }
  echo "Database backup: $BACKUP_FILE"
fi
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Deployment started. Follow logs with:"
echo "docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f app"
