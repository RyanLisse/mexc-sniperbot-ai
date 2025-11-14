# MEXC Sniper Bot AI - Documentation

## Overview

MEXC Sniper Bot AI is a high-performance cryptocurrency trading bot that monitors MEXC exchange for new token listings and executes buy orders within sub-second timeframes.

## Architecture

### Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, TanStack Query
- **Backend**: Bun runtime, tRPC, Effect-TS
- **Database**: Supabase PostgreSQL, Drizzle ORM
- **Real-time**: WebSocket, EventEmitter
- **Code Quality**: Ultracite (Biome), Qlty CLI

### Project Structure

```
mexc-sniperbot-ai/
├── apps/
│   └── web/              # Next.js fullstack application
│       ├── src/
│       │   ├── app/       # App Router pages and API routes
│       │   ├── components/ # React components
│       │   └── hooks/     # Custom React hooks
├── packages/
│   ├── api/              # tRPC routers and business logic
│   │   ├── src/
│   │   │   ├── routers/   # tRPC procedure definitions
│   │   │   ├── services/  # Business logic services
│   │   │   └── lib/       # Shared utilities
│   └── db/               # Database schema and queries
│       ├── src/
│       │   ├── schema/    # Drizzle schema definitions
│       │   └── migrations/ # Database migrations
└── tests/                # Test suites
    ├── contract/         # API contract tests
    ├── integration/      # Integration tests
    └── unit/             # Unit tests
```

## Key Features

### User Story 1: Automated Token Sniping
- Continuous monitoring of MEXC for new listings
- Automatic buy order execution within 100ms
- Exponential backoff retry logic
- Trade execution logging

### User Story 2: Real-Time Dashboard
- Live dashboard with trade history
- Performance metrics and alerts
- Real-time updates via WebSocket
- Error boundaries for resilience

### User Story 3: Configuration Management
- Trading parameters configuration
- Risk management settings
- Real-time configuration updates
- Configuration preview and reset

### User Story 4: Security & API Management
- Secure credential storage
- API key validation
- IP whitelisting
- Security audit logging

## Development

### Prerequisites

- Bun 1.3.0+
- Node.js 18+
- PostgreSQL (via Supabase)

### Setup

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
bun run db:push

# Start development server
bun run dev
```

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://...

# MEXC API
MEXC_API_KEY=your_api_key
MEXC_SECRET_KEY=your_secret_key
MEXC_BASE_URL=https://api.mexc.com

# Authentication
DASHBOARD_ADMIN_EMAIL=admin@example.com
DASHBOARD_ADMIN_PASSWORD_HASH=salt:hash
NEXTAUTH_SECRET=your_secret
```

## Testing

```bash
# Run all tests
bun test

# Run specific test suite
bun test tests/integration/

# Run with coverage
bun test --coverage
```

## Deployment

See deployment documentation in `docs/deployment.md`.

## Security

- API keys stored in environment variables
- HMAC SHA256 request signing
- IP whitelisting support
- Security audit logging
- Credential rotation support

## Performance Targets

- Listing detection: < 100ms (P99)
- Trade execution: < 100ms (goal: ≤80ms)
- Dashboard updates: < 1 second
- Uptime: 99.9%

## Contributing

See `CONTRIBUTING.md` for contribution guidelines.

## License

See `LICENSE` file.

