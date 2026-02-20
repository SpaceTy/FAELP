#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ORG_ENV="${DEPLOY_DIR}/orgbackend/container/.env"
DIST_ENV="${DEPLOY_DIR}/distbackend/container/.env"
OUT_ENV="${DEPLOY_DIR}/.env"

read_key() {
  local file="$1"
  local key="$2"
  local default_value="$3"

  if [ -f "$file" ]; then
    local line
    line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
    if [ -n "$line" ]; then
      printf '%s\n' "${line#*=}"
      return 0
    fi
  fi

  printf '%s\n' "$default_value"
}

org_postgres_host_port="$(read_key "$ORG_ENV" "POSTGRES_HOST_PORT" "5432")"
dist_postgres_host_port="$(read_key "$DIST_ENV" "POSTGRES_HOST_PORT" "5433")"

org_frontend_port="$(read_key "$ORG_ENV" "FRONTEND_USER_PORT" "8080")"
org_admin_port="$(read_key "$ORG_ENV" "FRONTEND_ADMIN_PORT" "8082")"
dist_frontend_port="$(read_key "$DIST_ENV" "FRONTEND_DISTRIBUTION_PORT" "8081")"
dist_admin_port="$(read_key "$DIST_ENV" "FRONTEND_ADMIN_PORT" "8083")"

org_postgres_user="$(read_key "$ORG_ENV" "POSTGRES_USER" "postgres")"
org_postgres_password="$(read_key "$ORG_ENV" "POSTGRES_PASSWORD" "postgres")"
org_postgres_db="$(read_key "$ORG_ENV" "POSTGRES_DB" "postgres")"

dist_postgres_user="$(read_key "$DIST_ENV" "POSTGRES_USER" "postgres")"
dist_postgres_password="$(read_key "$DIST_ENV" "POSTGRES_PASSWORD" "postgres")"
dist_postgres_db="$(read_key "$DIST_ENV" "POSTGRES_DB" "postgres")"

cat > "$OUT_ENV" <<EOF
# Auto-generated from orgbackend/container/.env and distbackend/container/.env
# Regenerate via: make sync-deploy-env

ORG_POSTGRES_HOST_PORT=${org_postgres_host_port}
DIST_POSTGRES_HOST_PORT=${dist_postgres_host_port}

ORG_FRONTEND_PORT=${org_frontend_port}
ORG_ADMIN_PORT=${org_admin_port}
DIST_FRONTEND_PORT=${dist_frontend_port}
DIST_ADMIN_PORT=${dist_admin_port}

ORG_POSTGRES_USER=${org_postgres_user}
ORG_POSTGRES_PASSWORD=${org_postgres_password}
ORG_POSTGRES_DB=${org_postgres_db}

DIST_POSTGRES_USER=${dist_postgres_user}
DIST_POSTGRES_PASSWORD=${dist_postgres_password}
DIST_POSTGRES_DB=${dist_postgres_db}
EOF

echo "Wrote compose env: ${OUT_ENV}"
