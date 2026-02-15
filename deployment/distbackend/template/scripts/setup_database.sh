#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-distdb_dev}"
DB_USER="${DB_USER:-app_distbackend_dev}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_RECREATE="${DB_RECREATE:-false}"
DB_GRANT_SUPERUSER="${DB_GRANT_SUPERUSER:-false}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "======================================"
echo "PostgreSQL Database Setup for distbackend"
echo "======================================"
echo "Database: ${DB_NAME}"
echo "App User: ${DB_USER}"
echo "Postgres Host: ${DB_HOST}:${DB_PORT}"
echo

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql command not found. Install postgresql-client first."
  exit 1
fi

wait_for_postgres() {
  local retries=30
  local delay=2

  echo "Waiting for PostgreSQL to become available..."
  for i in $(seq 1 "${retries}"); do
    if psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
      echo "PostgreSQL is available"
      return 0
    fi
    sleep "${delay}"
  done

  echo "Error: PostgreSQL did not become available in time"
  exit 1
}

wait_for_postgres

DB_EXISTS=$(psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" || echo "0")
if [ "${DB_EXISTS}" = "1" ] && [ "${DB_RECREATE}" = "true" ]; then
  echo "Recreating database '${DB_NAME}'"
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
  DB_EXISTS="0"
fi

if [ "${DB_EXISTS}" != "1" ]; then
  echo "Creating database '${DB_NAME}'"
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\";"
else
  echo "Database '${DB_NAME}' already exists"
fi

USER_EXISTS=$(psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" || echo "0")
if [ "${USER_EXISTS}" = "1" ]; then
  echo "Updating password for existing user '${DB_USER}'"
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "ALTER USER \"${DB_USER}\" WITH PASSWORD '${DB_PASSWORD}';"
else
  echo "Creating user '${DB_USER}'"
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "CREATE USER \"${DB_USER}\" WITH PASSWORD '${DB_PASSWORD}';"
fi

echo "Granting permissions"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "GRANT CONNECT ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "GRANT CREATE ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "GRANT USAGE, CREATE ON SCHEMA public TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"${DB_USER}\";"
psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"${DB_USER}\";"

if [ "${DB_GRANT_SUPERUSER}" = "true" ]; then
  echo "Granting superuser to '${DB_USER}'"
  psql -U "${POSTGRES_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d postgres -c "ALTER USER \"${DB_USER}\" WITH SUPERUSER;"
fi

unset PGPASSWORD

if PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -h "${DB_HOST}" -p "${DB_PORT}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "Connection test successful"
else
  echo "Warning: Could not connect as '${DB_USER}'"
fi

echo "Database setup complete"
