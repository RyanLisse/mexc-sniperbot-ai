# mexc-sniperbot-ai Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-11-06

## Active Technologies
- TypeScript (Encore runtime + React 19 / Next.js 16) + `encore.dev/api`, mexc-api-sdk (Spot), React Query, shadcn/ui, TanStack Form, Drizzle ORM, Pino logging, Encore Cron & Pub/Sub where needed (001-encore-refactor)
- Encore-managed PostgreSQL (`BotDB`) for runtime data; reuse `packages/db` schema definitions for compatibility exports (001-encore-refactor)

- TypeScript 5.7+ (Next.js 16 requirement) + Next.js 16, tRPC, Drizzle ORM, Effect-TS, TanStack Query, Ultracite (Biome), Qlty CLI (001-mexc-sniper-bot)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.7+ (Next.js 16 requirement): Follow standard conventions

## Recent Changes
- 001-encore-refactor: Added TypeScript (Encore runtime + React 19 / Next.js 16) + `encore.dev/api`, mexc-api-sdk (Spot), React Query, shadcn/ui, TanStack Form, Drizzle ORM, Pino logging, Encore Cron & Pub/Sub where needed

- 001-mexc-sniper-bot: Added TypeScript 5.7+ (Next.js 16 requirement) + Next.js 16, tRPC, Drizzle ORM, Effect-TS, TanStack Query, Ultracite (Biome), Qlty CLI

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
