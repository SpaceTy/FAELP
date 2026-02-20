#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/.." && pwd)"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_DIR="${DEPLOY_DIR}/releases"
ARCHIVE_NAME="${1:-faelp_deployment_${TIMESTAMP}.tar.gz}"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

mkdir -p "${OUTPUT_DIR}"

required_paths=(
  "deployment/orgbackend/container"
  "deployment/distbackend/container"
  "deployment/docker-compose.production.yml"
  "deployment/PRODUCTION.md"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "${REPO_ROOT}/${path}" ]; then
    echo "Missing required path: ${path}"
    echo "Run 'make deploy-org deploy-dist' first."
    exit 1
  fi
done

tar -C "${REPO_ROOT}" -czf "${ARCHIVE_PATH}" \
  deployment/orgbackend/container \
  deployment/distbackend/container \
  deployment/docker-compose.production.yml \
  deployment/PRODUCTION.md

echo "Created deployment archive: ${ARCHIVE_PATH}"
