#!/usr/bin/env bash
set -euo pipefail

# Promote an orgbackend user to admin by email.
# Defaults are aligned with deployment/orgbackend/template/.env.example.
#
# Usage:
#   ./make_user_admin.sh user@example.com
#
# Optional env overrides:
#   DB_HOST (default: 127.0.0.1)
#   DB_PORT (default: 5432)
#   DB_NAME (default: orgdb_dev)
#   POSTGRES_USER (default: postgres)
#   POSTGRES_PASSWORD (default: postgres)

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <user_email>"
  exit 1
fi

USER_EMAIL="$1"
ESCAPED_EMAIL="$(printf "%s" "$USER_EMAIL" | sed "s/'/''/g")"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-orgdb_dev}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql command not found. Install postgresql-client first."
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"

exists_count="$(
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -tAc \
    "SELECT COUNT(*) FROM users WHERE email = '${ESCAPED_EMAIL}';"
)"

if [ "${exists_count}" = "0" ]; then
  echo "No user found with email: ${USER_EMAIL}"
  exit 1
fi

psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c \
  "UPDATE users SET is_admin = true WHERE email = '${ESCAPED_EMAIL}';"

unset PGPASSWORD
echo "User promoted to admin: ${USER_EMAIL}"
