#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Initializing test database...${NC}"

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Start test database
echo -e "${YELLOW}📦 Starting test PostgreSQL container...${NC}"
docker-compose -f docker-compose.test.yml up -d test-db

# Wait for database to be healthy
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose -f docker-compose.test.yml exec -T test-db pg_isready -U test -d test > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready!${NC}"
        break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $((elapsed % 5)) -eq 0 ]; then
        echo -e "${YELLOW}   Still waiting... (${elapsed}s/${timeout}s)${NC}"
    fi
done

if [ $elapsed -ge $timeout ]; then
    echo -e "${RED}❌ Database failed to start within ${timeout} seconds${NC}"
    docker-compose -f docker-compose.test.yml logs test-db
    exit 1
fi

# Run database migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
cd packages/db
DATABASE_URL="postgresql://test:test@localhost:5433/test" bun run db:push
cd ../..

# Seed test data (optional)
if [ -f "scripts/seed-test-data.ts" ]; then
    echo -e "${YELLOW}🌱 Seeding test data...${NC}"
    bun run scripts/seed-test-data.ts
fi

echo -e "${GREEN}✅ Test database initialized successfully!${NC}"
echo -e "${GREEN}   Connection: postgresql://test:test@localhost:5433/test${NC}"
echo -e "${YELLOW}💡 To stop: docker-compose -f docker-compose.test.yml down${NC}"
echo -e "${YELLOW}💡 To reset: docker-compose -f docker-compose.test.yml down -v${NC}"
