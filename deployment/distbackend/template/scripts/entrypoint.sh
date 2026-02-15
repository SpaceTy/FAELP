#!/usr/bin/env bash
set -euo pipefail

ENV_FILE_PATH="${ENV_FILE_PATH:-/app/.env}"

is_placeholder_secret() {
  local value="${1:-}"
  [ -z "${value}" ] || [ "${value}" = "replace-me" ] || [ "${value}" = "replace_me" ]
}

generate_jwt_secret() {
  head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '='
}

persist_jwt_secret() {
  local secret="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  if [ ! -f "${ENV_FILE_PATH}" ] || [ ! -w "${ENV_FILE_PATH}" ]; then
    echo "Warning: Cannot persist JWT_SECRET to ${ENV_FILE_PATH}"
    rm -f "${tmp_file}"
    return 0
  fi

  if grep -q '^JWT_SECRET=' "${ENV_FILE_PATH}"; then
    awk -v s="${secret}" 'BEGIN{updated=0} /^JWT_SECRET=/{print "JWT_SECRET=" s; updated=1; next} {print} END{if(!updated) print "JWT_SECRET=" s}' "${ENV_FILE_PATH}" > "${tmp_file}"
  else
    cat "${ENV_FILE_PATH}" > "${tmp_file}"
    echo "JWT_SECRET=${secret}" >> "${tmp_file}"
  fi

  cat "${tmp_file}" > "${ENV_FILE_PATH}"
  rm -f "${tmp_file}"
}

if is_placeholder_secret "${JWT_SECRET:-}"; then
  generated_jwt_secret="$(generate_jwt_secret)"
  export JWT_SECRET="${generated_jwt_secret}"
  persist_jwt_secret "${generated_jwt_secret}"
  echo "Generated JWT_SECRET and persisted to ${ENV_FILE_PATH}"
fi

echo "Running dist database setup script..."
/app/scripts/setup_database.sh

echo "Starting dist backend..."
exec /app/distbackend
