#!/bin/bash
# =============================================================================
# Personal Inventory Portable — Stop All Services
# =============================================================================
# Usage: ./scripts/stop.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "Stopping all Personal Inventory services..."
docker compose down

echo ""
echo "All services stopped. Data is preserved in Docker volumes."
echo "Run ./scripts/start.sh to restart."
echo ""
