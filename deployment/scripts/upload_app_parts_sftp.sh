#!/usr/bin/env bash
set -euo pipefail

# Upload only container /app directories for orgbackend and distbackend via SFTP.
#
# Defaults:
#   Host: apply.tysmp.com
#   User: current shell user
#   Remote base: /home/st/fae
#
# Result on server:
#   <remote-base>/orgbackend/container/app
#   <remote-base>/distbackend/container/app
#
# Strategy:
#   1) Create tar.gz archives of local /app directories
#   2) Upload archives via SFTP
#   3) SSH into server, delete old app/frontend directories, then extract archives
#
# Usage:
#   deployment/scripts/upload_app_parts_sftp.sh
#   deployment/scripts/upload_app_parts_sftp.sh --user st --remote-base /home/st/fae

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

HOST="apply.tysmp.com"
REMOTE_USER="${USER:-}"
REMOTE_BASE="/home/st/fae"

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
    -h|--help)
      cat <<'EOF'
Upload deployment /app directories via SFTP.

Options:
  --user <name>         Remote SSH user (default: current local user)
  --remote-base <path>  Remote base directory (default: /home/st/fae)
  --host <host>         Remote host (default: apply.tysmp.com)
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

echo "Creating local archives..."
tar -C "${ORG_APP_LOCAL}" -czf "${ORG_TAR_LOCAL}" .
tar -C "${DIST_APP_LOCAL}" -czf "${DIST_TAR_LOCAL}" .

REMOTE_TMP_DIR="${REMOTE_BASE}/.upload_tmp"
REMOTE_ORG_TAR="${REMOTE_TMP_DIR}/org_app.tar.gz"
REMOTE_DIST_TAR="${REMOTE_TMP_DIR}/dist_app.tar.gz"

cat > "${tmp_batch}" <<EOF
-mkdir ${REMOTE_BASE}
-mkdir ${REMOTE_TMP_DIR}
put ${ORG_TAR_LOCAL} ${REMOTE_ORG_TAR}
put ${DIST_TAR_LOCAL} ${REMOTE_DIST_TAR}
bye
EOF

echo "Uploading archives to ${SFTP_TARGET}:${REMOTE_TMP_DIR}"
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
