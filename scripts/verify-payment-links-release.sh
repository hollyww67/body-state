#!/bin/sh
set -eu
cd /opt/doctor-site

attempt=0
until curl -fsS http://127.0.0.1:3000/api/health >/dev/null; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || exit 1
  sleep 2
done

echo HEALTH
curl -fsS http://127.0.0.1:3000/api/health
echo
echo MIGRATION
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U doctor_site -d doctor_site -Atc \
  "select filename from schema_migrations where filename='011_manual_payment_links.sql';" </dev/null
echo ROUTES
curl -sS -o /dev/null -w 'admin_page=%{http_code}\n' https://body-state.ru/admin/payment-links
curl -sS -o /dev/null -w 'anonymous_api=%{http_code}\n' https://body-state.ru/api/admin/payment-links
echo LOGS
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=30 app 2>&1
echo QA_ROWS
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U doctor_site -d doctor_site -Atc \
  "select count(*) from orders where payment_method='tinkoff_link' and receipt_email='admin@body-state.ru' and items::text like '%QA payment link%';" </dev/null
echo DISK
df -h / | tail -1
