#!/usr/bin/env bash
set -euo pipefail

echo "Running org database setup script..."
/app/scripts/setup_database.sh

echo "Starting org backend..."
exec /app/orgbackend
