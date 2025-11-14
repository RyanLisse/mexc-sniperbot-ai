#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning up test database...${NC}"

# Stop and remove containers
docker-compose -f docker-compose.test.yml down

# Optional: Remove volumes (full reset)
if [ "${1:-}" = "--full" ] || [ "${1:-}" = "-f" ]; then
    echo -e "${YELLOW}🗑️  Removing volumes (full reset)...${NC}"
    docker-compose -f docker-compose.test.yml down -v
    echo -e "${GREEN}✅ Full cleanup complete (volumes removed)${NC}"
else
    echo -e "${GREEN}✅ Cleanup complete (volumes preserved)${NC}"
    echo -e "${YELLOW}💡 Use './scripts/cleanup-test-db.sh --full' to remove volumes${NC}"
fi
