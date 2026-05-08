#!/bin/bash
# =============================================================================
# Personal Inventory Portable — Start All Services
# =============================================================================
# Usage: ./scripts/start.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running or your user cannot access the daemon."
    echo "  Ubuntu/Linux: sudo systemctl start docker"
    echo "                sudo usermod -aG docker \"\$USER\"  # then log out and back in"
    echo "  macOS:        open -a Docker"
    exit 1
fi

echo "Starting Personal Inventory System..."
docker compose up -d

echo ""
echo "All services starting. Some may take 1-3 minutes to become healthy."
echo ""
echo "  Inventory App:   http://localhost:3000"
echo "  MinIO Console:   http://localhost:9001"
echo "  Medusa Admin:    http://localhost:9500/app"
echo "  n8n Workflows:   http://localhost:5678"
echo "  ERPNext:         http://localhost:8090"
echo ""
echo "Check status: docker compose ps"
echo ""
