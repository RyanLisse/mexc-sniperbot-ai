FROM oven/bun:1.3.0 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages packages
COPY apps apps
RUN bun install --frozen-lockfile

# Build application
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production image
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000
CMD ["bun", "run", "apps/web"]

