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

org_db_port="$(read_key "$ORG_ENV" "DB_PORT" "5432")"
dist_db_port="$(read_key "$DIST_ENV" "DB_PORT" "5432")"

org_internal_socket_path="$(read_key "$ORG_ENV" "INTERNAL_SOCKET_PATH" "/var/run/faelp/org-backend.sock")"
org_internal_socket_enabled="$(read_key "$ORG_ENV" "INTERNAL_SOCKET_ENABLED" "true")"
org_dist_backend_socket_path="$(read_key "$ORG_ENV" "DIST_BACKEND_SOCKET_PATH" "/var/run/faelp/dist-backend.sock")"

dist_internal_socket_path="$(read_key "$DIST_ENV" "INTERNAL_SOCKET_PATH" "/var/run/faelp/dist-backend.sock")"
dist_internal_socket_enabled="$(read_key "$DIST_ENV" "INTERNAL_SOCKET_ENABLED" "true")"
dist_org_backend_socket_path="$(read_key "$DIST_ENV" "ORG_BACKEND_SOCKET_PATH" "/var/run/faelp/org-backend.sock")"

org_frontend_user_path="$(read_key "$ORG_ENV" "FRONTEND_USER_PATH" "/app/frontend/user/dist")"
org_frontend_admin_path="$(read_key "$ORG_ENV" "FRONTEND_ADMIN_PATH" "/app/frontend/orgadmin/dist")"
dist_frontend_distribution_path="$(read_key "$DIST_ENV" "FRONTEND_DISTRIBUTION_PATH" "/app/frontend/distribution/dist")"
dist_frontend_admin_path="$(read_key "$DIST_ENV" "FRONTEND_ADMIN_PATH" "/app/frontend/distadmin/dist")"

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
ORG_DB_PORT=${org_db_port}
DIST_DB_PORT=${dist_db_port}

ORG_INTERNAL_SOCKET_PATH=${org_internal_socket_path}
ORG_INTERNAL_SOCKET_ENABLED=${org_internal_socket_enabled}
ORG_DIST_BACKEND_SOCKET_PATH=${org_dist_backend_socket_path}
DIST_INTERNAL_SOCKET_PATH=${dist_internal_socket_path}
DIST_INTERNAL_SOCKET_ENABLED=${dist_internal_socket_enabled}
DIST_ORG_BACKEND_SOCKET_PATH=${dist_org_backend_socket_path}

ORG_FRONTEND_USER_PATH=${org_frontend_user_path}
ORG_FRONTEND_ADMIN_PATH=${org_frontend_admin_path}
DIST_FRONTEND_DISTRIBUTION_PATH=${dist_frontend_distribution_path}
DIST_FRONTEND_ADMIN_PATH=${dist_frontend_admin_path}

ORG_POSTGRES_USER=${org_postgres_user}
ORG_POSTGRES_PASSWORD=${org_postgres_password}
ORG_POSTGRES_DB=${org_postgres_db}

DIST_POSTGRES_USER=${dist_postgres_user}
DIST_POSTGRES_PASSWORD=${dist_postgres_password}
DIST_POSTGRES_DB=${dist_postgres_db}
EOF

echo "Wrote compose env: ${OUT_ENV}"
