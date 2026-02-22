#!/usr/bin/env bash
set -euo pipefail

# Build backend container images, export as tar files, and upload to server via SFTP.
#
# Usage:
#   deployment/scripts/release_backend_images_sftp.sh
#   deployment/scripts/release_backend_images_sftp.sh --component org
#   deployment/scripts/release_backend_images_sftp.sh --component dist
#   deployment/scripts/release_backend_images_sftp.sh --host example.com --user deploy --remote-dir /srv/faelp/releases

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RELEASES_DIR="${REPO_ROOT}/deployment/releases"
HOST="apply.tysmp.com"
REMOTE_USER="${USER:-}"
REMOTE_DIR="/home/st/fae/releases/images"
COMPONENT="both"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ORG_IMAGE_TAG="localhost/faelp-orgbackend:${TIMESTAMP}"
DIST_IMAGE_TAG="localhost/faelp-distbackend:${TIMESTAMP}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --component)
      COMPONENT="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Build backend Podman images, save as tar files, and upload with SFTP.

Options:
  --host <host>          Remote host (default: apply.tysmp.com)
  --user <name>          Remote SSH user (default: current local user)
  --remote-dir <path>    Remote directory for uploaded image tar files
                         (default: /home/st/fae/releases/images)
  --component <name>     Image set to release: org | dist | both (default: both)
  -h, --help             Show this help
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

case "${COMPONENT}" in
  org|dist|both)
    ;;
  *)
    echo "Invalid --component value: ${COMPONENT}. Expected org, dist, or both."
    exit 1
    ;;
esac

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required but was not found in PATH."
  exit 1
fi

if ! command -v sftp >/dev/null 2>&1; then
  echo "sftp is required but was not found in PATH."
  exit 1
fi

ORG_CONTEXT="${REPO_ROOT}/deployment/orgbackend/container"
DIST_CONTEXT="${REPO_ROOT}/deployment/distbackend/container"
ORG_TAR="${RELEASES_DIR}/orgbackend_image_${TIMESTAMP}.tar"
DIST_TAR="${RELEASES_DIR}/distbackend_image_${TIMESTAMP}.tar"

if [ "${COMPONENT}" = "org" ] || [ "${COMPONENT}" = "both" ]; then
  if [ ! -d "${ORG_CONTEXT}" ]; then
    echo "Missing local directory: ${ORG_CONTEXT}"
    echo "Run 'make deploy-org' first."
    exit 1
  fi
fi

if [ "${COMPONENT}" = "dist" ] || [ "${COMPONENT}" = "both" ]; then
  if [ ! -d "${DIST_CONTEXT}" ]; then
    echo "Missing local directory: ${DIST_CONTEXT}"
    echo "Run 'make deploy-dist' first."
    exit 1
  fi
fi

mkdir -p "${RELEASES_DIR}"

if [ "${COMPONENT}" = "org" ] || [ "${COMPONENT}" = "both" ]; then
  echo "Building orgbackend image: ${ORG_IMAGE_TAG}"
  podman build -t "${ORG_IMAGE_TAG}" "${ORG_CONTEXT}"
  echo "Saving orgbackend image tar: ${ORG_TAR}"
  podman save -o "${ORG_TAR}" "${ORG_IMAGE_TAG}"
fi

if [ "${COMPONENT}" = "dist" ] || [ "${COMPONENT}" = "both" ]; then
  echo "Building distbackend image: ${DIST_IMAGE_TAG}"
  podman build -t "${DIST_IMAGE_TAG}" "${DIST_CONTEXT}"
  echo "Saving distbackend image tar: ${DIST_TAR}"
  podman save -o "${DIST_TAR}" "${DIST_IMAGE_TAG}"
fi

SFTP_TARGET="${REMOTE_USER}@${HOST}"
tmp_batch="$(mktemp)"
cleanup() {
  rm -f "${tmp_batch}"
}
trap cleanup EXIT

{
  echo "-mkdir ${REMOTE_DIR}"
  if [ "${COMPONENT}" = "org" ] || [ "${COMPONENT}" = "both" ]; then
    echo "put ${ORG_TAR} ${REMOTE_DIR}/$(basename "${ORG_TAR}")"
  fi
  if [ "${COMPONENT}" = "dist" ] || [ "${COMPONENT}" = "both" ]; then
    echo "put ${DIST_TAR} ${REMOTE_DIR}/$(basename "${DIST_TAR}")"
  fi
  echo "bye"
} > "${tmp_batch}"

echo "Uploading image tar files to ${SFTP_TARGET}:${REMOTE_DIR}"
sftp -o BatchMode=no -b "${tmp_batch}" "${SFTP_TARGET}"

echo "Upload complete."
if [ "${COMPONENT}" = "org" ] || [ "${COMPONENT}" = "both" ]; then
  echo "  ${REMOTE_DIR}/$(basename "${ORG_TAR}")"
fi
if [ "${COMPONENT}" = "dist" ] || [ "${COMPONENT}" = "both" ]; then
  echo "  ${REMOTE_DIR}/$(basename "${DIST_TAR}")"
fi
