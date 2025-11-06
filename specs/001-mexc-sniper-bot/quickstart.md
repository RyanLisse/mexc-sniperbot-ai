# Quickstart Guide: MEXC Sniper Bot AI

**Purpose**: Setup and deployment instructions for the trading system
**Created**: 2025-01-06
**Feature**: [spec.md](./spec.md)

## Prerequisites

### Development Environment
- **Node.js**: 18+ or Bun 1.0+
- **Database**: PostgreSQL 14+ (local or Supabase)
- **Package Manager**: Bun (recommended) or npm/yarn
- **Git**: For version control
- **IDE**: VS Code with recommended extensions

### Required Accounts
- **MEXC Exchange**: API credentials with spot trading permissions
- **Supabase**: PostgreSQL database and real-time services (optional, can use local Postgres)
- **Environment**: Local development machine or cloud deployment

## Project Setup

### 1. Repository Initialization
```bash
# Clone the repository
git clone <repository-url>
cd mexc-sniperbot-ai

# Install dependencies
bun install

# Copy environment template
cp .env.example .env.local
```

### 2. Environment Configuration
```bash
# .env.local
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mexc_sniper_bot"

# MEXC API Configuration
MEXC_API_KEY="your_mexc_api_key"
MEXC_SECRET_KEY="your_mexc_secret_key"
MEXC_BASE_URL="https://api.mexc.com"

# Application
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="http://localhost:3001"

# Development
NODE_ENV="development"
LOG_LEVEL="debug"
```

### 3. Database Setup
```bash
# Generate database schema
bun run db:generate

# Push schema to database
bun run db:push

# Seed initial data (optional)
bun run db:seed
```

### 4. Start Development Server
```bash
# Start all services in development mode
bun run dev

# Or start individual services
bun run dev:web     # Next.js application
bun run dev:api     # API server (if separate)
bun run db:studio   # Database GUI
```

## Configuration

### 1. Trading Parameters
Access the dashboard at `http://localhost:3001` and configure:

- **Target Pairs**: Select cryptocurrency pairs to monitor
- **Purchase Amount**: Set maximum USDT per trade (e.g., 100)
- **Price Tolerance**: Configure acceptable price deviation (e.g., 2%)
- **Daily Limits**: Set maximum daily trading volume
- **Rate Limits**: Configure trades per hour to prevent excessive activity

### 2. Risk Management Settings
- **Stop Loss**: Automatic position closing (future feature)
- **Take Profit**: Target profit levels (future feature)
- **Maximum Position Size**: Limit exposure per token
- **Blacklist**: Tokens to avoid trading

### 3. Monitoring Configuration
- **Alert Settings**: Email/webhook notifications
- **Logging Level**: Debug, info, warning, error
- **Performance Metrics**: Enable detailed tracking
- **Health Checks**: Configure monitoring intervals

## Testing

### 1. Unit Tests
```bash
# Run all unit tests
bun test

# Run with coverage
bun test --coverage

# Run specific test files
bun test packages/api/src/services/mexc.test.ts
```

### 2. Integration Tests
```bash
# Run integration tests
bun run test:integration

# Test MEXC API integration
bun run test:mexc-api

# Test trading flows
bun run test:trading-flows
```

### 3. Contract Tests
```bash
# Test API contracts
bun run test:contracts

# Validate tRPC schemas
bun run test:schemas
```

### 4. Performance Tests
```bash
# Test response times
bun run test:performance

# Load testing
bun run test:load
```

## Deployment

### 1. Production Build
```bash
# Build all packages
bun run build

# Build specific packages
bun run build:web
bun run build:api
```

### 2. Environment Setup
```bash
# Production environment variables
NODE_ENV="production"
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
MEXC_API_KEY="production_api_key"
MEXC_SECRET_KEY="production_secret_key"
LOG_LEVEL="info"
```

### 3. Database Migration
```bash
# Run database migrations
bun run db:migrate:prod

# Verify schema
bun run db:verify
```

### 4. Application Deployment
```bash
# Deploy to Vercel (recommended)
vercel --prod

# Or deploy to custom hosting
bun run start:prod
```

## Monitoring

### 1. Health Checks
```bash
# Check application health
curl http://localhost:3001/api/health

# Check MEXC API connectivity
curl http://localhost:3001/api/trading/test-connectivity
```

### 2. Logs and Metrics
```bash
# View application logs
bun run logs

# Monitor performance metrics
bun run metrics

# Check error rates
bun run errors
```

### 3. Dashboard Access
- **Main Dashboard**: `http://localhost:3001/dashboard`
- **Configuration**: `http://localhost:3001/settings`
- **Trade History**: `http://localhost:3001/trades`
- **System Status**: `http://localhost:3001/status`

## Troubleshooting

### Common Issues

#### 1. API Connection Errors
```bash
# Check MEXC API credentials
curl -H "X-MEXC-APIKEY: your_key" https://api.mexc.com/api/v3/ping

# Verify network connectivity
ping api.mexc.com

# Check rate limits
curl https://api.mexc.com/api/v3/rateLimit
```

#### 2. Database Connection Issues
```bash
# Test database connection
bun run db:test-connection

# Check schema
bun run db:schema:validate

# Reset database (development only)
bun run db:reset
```

#### 3. Performance Issues
```bash
# Profile application
bun run profile

# Check memory usage
bun run memory:check

# Analyze bundle size
bun run analyze:bundle
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| E001 | MEXC API authentication failed | Check API keys and permissions |
| E002 | Rate limit exceeded | Reduce polling frequency |
| E003 | Insufficient balance | Add funds to trading account |
| E004 | Invalid trading pair | Verify symbol format |
| E005 | Order too small | Increase order amount |
| E006 | Market closed | Check trading hours |
| E007 | Network timeout | Check internet connection |

## Security

### 1. API Key Management
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate API keys regularly
- Enable IP whitelisting in MEXC settings

### 2. Application Security
- Enable HTTPS in production
- Use secure cookies for authentication
- Implement rate limiting on all endpoints
- Regular security updates and patches

### 3. Trading Security
- Start with small test amounts
- Use paper trading mode for testing
- Set conservative limits initially
- Monitor for unusual activity

## Best Practices

### 1. Development
- Follow TypeScript strict mode
- Use Effect-TS for error handling
- Write tests before implementation
- Commit frequently with clear messages

### 2. Configuration
- Start with conservative settings
- Test with small amounts first
- Monitor performance continuously
- Keep backup configurations

### 3. Operations
- Monitor system health 24/7
- Set up alerts for critical errors
- Regular backup of trading data
- Document all configuration changes

## Support

### Documentation
- [API Reference](./contracts/trpc-router.md)
- [Data Model](./data-model.md)
- [Constitution](../.specify/memory/constitution.md)

### Community
- GitHub Issues: Report bugs and request features
- Discord Chat: Real-time discussion and support
- Documentation: Comprehensive guides and tutorials

### Emergency Contacts
- System Administrator: [contact info]
- Trading Support: [contact info]
- Security Team: [contact info]

---

**Next Steps**: After completing setup, proceed to [tasks.md](./tasks.md) for implementation guidance.
