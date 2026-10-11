#!/bin/sh
set -eu
cd /opt/doctor-site

compose="docker compose --env-file .env.production -f docker-compose.prod.yml"
session_token="$(cat /proc/sys/kernel/random/uuid)"
session_version="$($compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" GET admin-session-version' </dev/null | tr -d '\r')"
session_version="${session_version:-1}"

cleanup() {
  $compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" DEL "admin-session:$1" >/dev/null' sh "$session_token" </dev/null || true
}
trap cleanup EXIT

$compose exec -T redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" SETEX "admin-session:$1" 300 "$2" >/dev/null' sh "$session_token" "$session_version" </dev/null

created="$(curl -fsS http://127.0.0.1:3000/api/admin/payment-links \
  -H "Authorization: Bearer $session_token" \
  -H 'Content-Type: application/json' \
  --data '{"name":"QA payment link — delete","amount":10,"email":"admin@body-state.ru","lifetimeDays":1}')"

order_id="$(printf '%s' "$created" | python3 -c 'import json,sys,uuid; data=json.load(sys.stdin); value=data["link"]["id"]; uuid.UUID(value); print(value)')"
payment_id="$(printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin)["link"]["paymentId"])')"
payment_host="$(printf '%s' "$created" | python3 -c 'import json,sys,urllib.parse; print(urllib.parse.urlparse(json.load(sys.stdin)["link"]["paymentUrl"]).hostname or "")')"

case "$payment_host" in
  pay.tbank.ru|*.tbank.ru|securepay.tinkoff.ru|*.tinkoff.ru) ;;
  *) echo "Unexpected payment host: $payment_host"; exit 1 ;;
esac

cancelled="$(curl -fsS http://127.0.0.1:3000/api/payment/cancel \
  -H "Authorization: Bearer $session_token" \
  -H 'Content-Type: application/json' \
  --data "{\"paymentId\":\"$payment_id\"}")"

cancel_ok="$(printf '%s' "$cancelled" | python3 -c 'import json,sys; print("yes" if json.load(sys.stdin).get("success") is True else "no")')"
status="$($compose exec -T postgres psql -U doctor_site -d doctor_site -Atc "select status from orders where id='$order_id';" </dev/null | tr -d '\r')"

echo "REAL_INIT_OK=yes"
echo "PAYMENT_HOST=$payment_host"
echo "CANCEL_OK=$cancel_ok"
echo "DB_STATUS=$status"

if [ "$cancel_ok" = "yes" ] && [ "$status" = "cancelled" ]; then
  deleted="$($compose exec -T postgres psql -U doctor_site -d doctor_site -Atc "delete from orders where id='$order_id' and receipt_email='admin@body-state.ru' and payment_method='tinkoff_link' and status='cancelled' returning id;" </dev/null | tr -d '\r' | head -1)"
  [ "$deleted" = "$order_id" ]
  echo "QA_CLEANED=yes"
else
  echo "QA_CLEANED=no"
  exit 1
fi
