# Database migrations for one commit: supabase/migrations plus the all-or-nothing runner. Also
# carries the nightly purge of deleted recipes (spec 018, infra/bin/cocon-purge): `node purge.mjs`,
# the Edge Functions that cocon-deploy installs in Supabase (spec 019), and infra/VERSION, the
# server scripts the commit needs.
FROM node:24.11-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile --filter our-cocon \
 && pnpm exec esbuild scripts/migrate.ts --bundle --platform=node --target=node24 --format=esm --outfile=/out/migrate.mjs \
      --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
 && pnpm exec esbuild scripts/purge-deleted.ts --bundle --platform=node --target=node24 --format=esm --outfile=/out/purge.mjs

FROM node:24.11-slim
WORKDIR /app
COPY --from=build /out/migrate.mjs /out/purge.mjs ./
COPY supabase/migrations ./migrations
COPY supabase/functions ./functions
COPY infra/VERSION ./infra-version
USER node
CMD ["node", "migrate.mjs", "migrations"]
