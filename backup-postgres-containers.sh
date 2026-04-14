#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./postgres-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

# Find all podman containers with "postgres" in the name
mapfile -t CONTAINERS < <(podman ps --format '{{.Names}}' | grep -i postgres)

if [[ ${#CONTAINERS[@]} -eq 0 ]]; then
    echo "No running podman containers with 'postgres' in the name found."
    exit 0
fi

for CONTAINER in "${CONTAINERS[@]}"; do
    echo "Processing container: $CONTAINER"

    # Get list of databases (exclude template databases)
    DATABASES=$(podman exec "$CONTAINER" \
        psql -U postgres -At -c \
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")

    if [[ -z "$DATABASES" ]]; then
        echo "  No databases found in $CONTAINER, skipping."
        continue
    fi

    for DB in $DATABASES; do
        echo "  Dumping database: $DB"

        TMPDIR="$(mktemp -d)"
        DUMP_FILE="${TMPDIR}/${DB}.dump"

        podman exec "$CONTAINER" \
            pg_dump -U postgres -Fc "$DB" > "$DUMP_FILE"

        TAR_NAME="${CONTAINER}_${DB}_${TIMESTAMP}.tar.gz"
        tar -czf "$BACKUP_DIR/$TAR_NAME" -C "$TMPDIR" .
        rm -rf "$TMPDIR"

        echo "  Created archive: $BACKUP_DIR/$TAR_NAME"
    done
done

echo "All backups complete. Stored in: $BACKUP_DIR"
