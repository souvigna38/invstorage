#!/bin/bash
# =============================================================================
# Create the n8n automation database alongside the inventory database.
# This runs during PostgreSQL's first-time initialization.
# =============================================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE n8n;
    GRANT ALL PRIVILEGES ON DATABASE n8n TO $POSTGRES_USER;
EOSQL

echo "✓ Created n8n database"
