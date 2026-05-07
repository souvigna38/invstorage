#!/bin/bash
# =============================================================================
# Create the Medusa database alongside the inventory database.
# This runs during PostgreSQL's first-time initialization.
# =============================================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE medusa_store;
    GRANT ALL PRIVILEGES ON DATABASE medusa_store TO $POSTGRES_USER;
EOSQL

echo "✓ Created medusa_store database"
