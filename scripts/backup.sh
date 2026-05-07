#!/bin/bash
# =============================================================================
# Personal Inventory Portable — Backup Current State
# =============================================================================
# Exports the current database to data/inventory_dump.sql so the portable
# package always has the latest data.
#
# Usage: ./scripts/backup.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/data"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running."
    exit 1
fi

# Check DB container is running
CONTAINER=$(docker compose ps -q db 2>/dev/null)
if [ -z "$CONTAINER" ]; then
    echo "ERROR: Database container is not running. Start services first."
    exit 1
fi

echo "Backing up inventory database..."

# Create timestamped backup
docker compose exec -T db pg_dump -U admin -d inventory \
    --no-owner --no-acl --clean --if-exists \
    > "$BACKUP_DIR/inventory_backup_${TIMESTAMP}.sql"

echo "  Timestamped backup: data/inventory_backup_${TIMESTAMP}.sql"

# Also update the main dump file (used by setup.sh)
docker compose exec -T db pg_dump -U admin -d inventory \
    --no-owner --no-acl --clean --if-exists \
    > "$BACKUP_DIR/inventory_dump.sql"

echo "  Main dump updated:  data/inventory_dump.sql"

# Count items
ITEM_COUNT=$(docker compose exec -T db psql -U admin -d inventory -t -c "SELECT count(*) FROM items;" | tr -d ' ')
echo ""
echo "Backup complete! ($ITEM_COUNT items exported)"
echo ""
