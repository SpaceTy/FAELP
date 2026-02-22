#!/usr/bin/env bash
set -euo pipefail

# Upload deployment artifacts via SFTP.
#
# Defaults:
#   Host: apply.tysmp.com
#   User: current shell user
#   Remote base: /home/st/fae
#
# Default result on server:
#   <remote-base>/docker-compose.production.yml
#   <remote-base>/.env
#   <remote-base>/orgbackend/container/app
#   <remote-base>/distbackend/container/app
#
# Optional full deployment result on server:
#   /home/st/fae   (entire local deployment/ directory uploaded and renamed)
#
# Strategies:
#   1) Create tar.gz archives of local /app directories
#   2) Upload archives via SFTP
#   3) SSH into server, delete old app/frontend directories, then extract archives
#
# Usage:
#   deployment/scripts/upload_app_parts_sftp.sh
#   deployment/scripts/upload_app_parts_sftp.sh --user st --remote-base /home/st/fae
#   deployment/scripts/upload_app_parts_sftp.sh --upload-full-deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

HOST="apply.tysmp.com"
REMOTE_USER="${USER:-}"
REMOTE_BASE="/home/st/fae"
UPLOAD_FULL_DEPLOYMENT="false"
FULL_DEPLOYMENT_REMOTE_DIR="/home/st/fae"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --remote-base)
      REMOTE_BASE="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --upload-full-deployment)
      UPLOAD_FULL_DEPLOYMENT="true"
      shift 1
      ;;
    --full-deployment-remote-dir)
      FULL_DEPLOYMENT_REMOTE_DIR="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Upload deployment artifacts via SFTP.

Options:
  --user <name>         Remote SSH user (default: current local user)
  --remote-base <path>  Remote base directory for app-parts mode (default: /home/st/fae)
  --host <host>         Remote host (default: apply.tysmp.com)
  --upload-full-deployment
                       Upload entire local deployment/ directory and install as /home/st/fae on server
  --full-deployment-remote-dir <path>
                       Remote path for full deployment mode (default: /home/st/fae)
  -h, --help            Show help
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "${REMOTE_USER}" ]; then
  echo "Remote user is empty. Set --user or USER."
  exit 1
fi

ORG_APP_LOCAL="${REPO_ROOT}/deployment/orgbackend/container/app"
DIST_APP_LOCAL="${REPO_ROOT}/deployment/distbackend/container/app"
FULL_DEPLOYMENT_LOCAL="${REPO_ROOT}/deployment"
COMPOSE_LOCAL="${REPO_ROOT}/deployment/docker-compose.production.yml"
DEPLOY_ENV_LOCAL="${REPO_ROOT}/deployment/.env"

if [ "${UPLOAD_FULL_DEPLOYMENT}" = "true" ]; then
  if [ ! -d "${FULL_DEPLOYMENT_LOCAL}" ]; then
    echo "Missing local directory: ${FULL_DEPLOYMENT_LOCAL}"
    exit 1
  fi
else
  if [ ! -f "${COMPOSE_LOCAL}" ]; then
    echo "Missing local file: ${COMPOSE_LOCAL}"
    exit 1
  fi

  if [ ! -f "${DEPLOY_ENV_LOCAL}" ]; then
    echo "Missing local file: ${DEPLOY_ENV_LOCAL}"
    exit 1
  fi

  if [ ! -d "${ORG_APP_LOCAL}" ]; then
    echo "Missing local directory: ${ORG_APP_LOCAL}"
    echo "Run 'make deploy-org' first."
    exit 1
  fi

  if [ ! -d "${DIST_APP_LOCAL}" ]; then
    echo "Missing local directory: ${DIST_APP_LOCAL}"
    echo "Run 'make deploy-dist' first."
    exit 1
  fi
fi

SFTP_TARGET="${REMOTE_USER}@${HOST}"

# Try to unlock SSH keys up front so passphrase entry happens before file transfer.
if command -v ssh-add >/dev/null 2>&1; then
  echo "If your SSH key is locked, enter your key passphrase when prompted."
  # Intentionally allow failure here; sftp may still prompt successfully.
  ssh-add >/dev/null 2>&1 || true
fi

tmp_batch="$(mktemp)"
tmp_dir="$(mktemp -d)"
cleanup() {
  rm -f "${tmp_batch}"
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

ORG_TAR_LOCAL="${tmp_dir}/org_app.tar.gz"
DIST_TAR_LOCAL="${tmp_dir}/dist_app.tar.gz"
FULL_DEPLOYMENT_TAR_LOCAL="${tmp_dir}/deployment_full.tar.gz"

if [ "${UPLOAD_FULL_DEPLOYMENT}" = "true" ]; then
  echo "Creating full deployment archive..."
  tar -C "${REPO_ROOT}" -czf "${FULL_DEPLOYMENT_TAR_LOCAL}" deployment

  FULL_DEPLOYMENT_PARENT_DIR="$(dirname "${FULL_DEPLOYMENT_REMOTE_DIR}")"
  REMOTE_TMP_DIR="${FULL_DEPLOYMENT_PARENT_DIR}/.fae_upload_tmp"
  REMOTE_FULL_DEPLOYMENT_TAR="${REMOTE_TMP_DIR}/deployment_full.tar.gz"

  cat > "${tmp_batch}" <<EOF
-mkdir ${REMOTE_TMP_DIR}
put ${FULL_DEPLOYMENT_TAR_LOCAL} ${REMOTE_FULL_DEPLOYMENT_TAR}
bye
EOF

  echo "Uploading full deployment archive to ${SFTP_TARGET}:${REMOTE_TMP_DIR}"
  sftp -o BatchMode=no -b "${tmp_batch}" "${SFTP_TARGET}"
  echo "Upload complete. Installing remote ${FULL_DEPLOYMENT_REMOTE_DIR}..."

  ssh "${SFTP_TARGET}" bash -s -- "${FULL_DEPLOYMENT_REMOTE_DIR}" "${REMOTE_FULL_DEPLOYMENT_TAR}" "${REMOTE_TMP_DIR}" <<'EOF'
set -euo pipefail

remote_deployment_dir="$1"
remote_full_tar="$2"
remote_tmp_dir="$3"

remote_parent_dir="$(dirname "${remote_deployment_dir}")"
remote_dir_name="$(basename "${remote_deployment_dir}")"
remote_extract_dir="${remote_parent_dir}/deployment"

mkdir -p "${remote_parent_dir}"
rm -rf "${remote_deployment_dir}" "${remote_extract_dir}"
tar -xzf "${remote_full_tar}" -C "${remote_parent_dir}"
mv "${remote_extract_dir}" "${remote_deployment_dir}"
rm -f "${remote_full_tar}"
rmdir "${remote_tmp_dir}" 2>/dev/null || true
EOF

  echo "Remote replacement complete."
  echo "Remote path:"
  echo "  ${FULL_DEPLOYMENT_REMOTE_DIR}"
else
  echo "Creating local archives..."
  tar -C "${ORG_APP_LOCAL}" -czf "${ORG_TAR_LOCAL}" .
  tar -C "${DIST_APP_LOCAL}" -czf "${DIST_TAR_LOCAL}" .

  REMOTE_TMP_DIR="${REMOTE_BASE}/.upload_tmp"
  REMOTE_ORG_TAR="${REMOTE_TMP_DIR}/org_app.tar.gz"
  REMOTE_DIST_TAR="${REMOTE_TMP_DIR}/dist_app.tar.gz"

  cat > "${tmp_batch}" <<EOF
-mkdir ${REMOTE_BASE}
-mkdir ${REMOTE_TMP_DIR}
put ${COMPOSE_LOCAL} ${REMOTE_BASE}/docker-compose.production.yml
put ${DEPLOY_ENV_LOCAL} ${REMOTE_BASE}/.env
put ${ORG_TAR_LOCAL} ${REMOTE_ORG_TAR}
put ${DIST_TAR_LOCAL} ${REMOTE_DIST_TAR}
bye
EOF

  echo "Uploading compose/.env and app archives to ${SFTP_TARGET}:${REMOTE_BASE}"
  sftp -o BatchMode=no -b "${tmp_batch}" "${SFTP_TARGET}"
  echo "Upload complete. Replacing remote app directories..."

  ssh "${SFTP_TARGET}" bash -s -- "${REMOTE_BASE}" "${REMOTE_ORG_TAR}" "${REMOTE_DIST_TAR}" <<'EOF'
set -euo pipefail

remote_base="$1"
remote_org_tar="$2"
remote_dist_tar="$3"

mkdir -p "${remote_base}/orgbackend/container/app" "${remote_base}/distbackend/container/app"
rm -rf "${remote_base}/orgbackend/container/app/frontend" "${remote_base}/distbackend/container/app/frontend"
tar -xzf "${remote_org_tar}" -C "${remote_base}/orgbackend/container/app"
tar -xzf "${remote_dist_tar}" -C "${remote_base}/distbackend/container/app"
rm -f "${remote_org_tar}" "${remote_dist_tar}"
EOF

  echo "Remote replacement complete."
  echo "Remote paths:"
  echo "  ${REMOTE_BASE}/orgbackend/container/app"
  echo "  ${REMOTE_BASE}/distbackend/container/app"
fi
