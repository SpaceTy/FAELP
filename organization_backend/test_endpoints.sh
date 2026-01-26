#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

DELIVERY_DATE="$(python - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"

echo "Base URL: $BASE_URL"
echo "Delivery date: $DELIVERY_DATE"

create_request() {
  curl -sS -X POST "$BASE_URL/requests" \
    -H "Content-Type: application/json" \
    -d @- <<EOF
{
  "customerEmail": "school@example.org",
  "customerName": "Lincoln High",
  "deliveryDate": "$DELIVERY_DATE",
  "status": "pending",
  "shippingCustomerName": "Lincoln High",
  "shippingAddress": {
    "line1": "123 Main St",
    "line2": "",
    "city": "Springfield",
    "zipCode": "12345"
  },
  "items": {
    "bandage_kit": 2,
    "cpraed_kit": 1
  },
  "metadata": {
    "note": "test request"
  }
}
EOF
}

echo "== Create request =="
CREATE_RESPONSE="$(create_request)"
export CREATE_RESPONSE
echo "$CREATE_RESPONSE"

REQUEST_ID="$(python - <<'PY'
import json, os, sys
data = json.loads(os.environ["CREATE_RESPONSE"])
print(data["id"])
PY
)"

CUSTOMER_ID="$(python - <<'PY'
import json, os
data = json.loads(os.environ["CREATE_RESPONSE"])
print(data["customer"]["id"])
PY
)"

echo "Request ID: $REQUEST_ID"
echo "Customer ID: $CUSTOMER_ID"

echo "== Get request by id =="
curl -sS "$BASE_URL/requests/$REQUEST_ID" | python -m json.tool

echo "== List requests (limit=5) =="
curl -sS "$BASE_URL/requests?limit=5" | python -m json.tool

echo "== List requests (status=pending) =="
curl -sS "$BASE_URL/requests?status=pending" | python -m json.tool

echo "== List requests (customerId) =="
curl -sS "$BASE_URL/requests?customerId=$CUSTOMER_ID" | python -m json.tool

echo "== List requests (date range) =="
FROM_DATE="$(python - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"
TO_DATE="$(python - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"
curl -sS "$BASE_URL/requests?from=$FROM_DATE&to=$TO_DATE" | python -m json.tool

echo "== Subscribe to single request (SSE snapshot) =="
if command -v timeout >/dev/null 2>&1; then
  timeout 3s curl -N "$BASE_URL/requests/$REQUEST_ID/subscribe" || true
else
  curl -N "$BASE_URL/requests/$REQUEST_ID/subscribe" &
  SUB_PID=$!
  sleep 3
  kill "$SUB_PID" 2>/dev/null || true
fi

echo "== Subscribe to list updates (SSE) =="
if command -v timeout >/dev/null 2>&1; then
  timeout 3s curl -N "$BASE_URL/requests/subscribe" || true
else
  curl -N "$BASE_URL/requests/subscribe" &
  SUB_LIST_PID=$!
  sleep 3
  kill "$SUB_LIST_PID" 2>/dev/null || true
fi

echo "== Trigger list update by creating another request =="
create_request | python -m json.tool
