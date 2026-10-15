# Database migrations for one commit: supabase/migrations plus the all-or-nothing runner.
FROM node:24.11-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile --filter our-cocon \
 && pnpm exec esbuild scripts/migrate.ts --bundle --platform=node --target=node24 --format=esm --outfile=/out/migrate.mjs

FROM node:24.11-slim
WORKDIR /app
COPY --from=build /out/migrate.mjs ./
COPY supabase/migrations ./migrations
USER node
CMD ["node", "migrate.mjs", "migrations"]
