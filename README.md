# Our Cocon

A household app for families, run from the app or from any AI assistant through MCP. V1 covers recipes and groceries.

## Run it on your computer

You need Node 24, pnpm 12 (`corepack enable` installs it) and Docker Desktop, running.

```sh
pnpm install && pnpm dev
```

The first run starts a local Supabase (database, sign-in, storage) in Docker and writes `.env.local` from `env.example`. Then:

| What | Where |
| --- | --- |
| Web app | http://localhost:8081 |
| MCP server | http://localhost:8787/mcp |
| Local Supabase Studio | http://localhost:54323 |

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Local Supabase + web app + MCP server |
| `pnpm dev:phone` | Same, but serves the app to Expo Go on an iPhone on the same Wi-Fi (trusted Wi-Fi only) |
| `pnpm check` | Lint, type check and tests for what changed |
| `pnpm test <path>` | Tests for one file or folder |
| `pnpm test:all` | Every test (needs local Supabase running) |
| `pnpm db:new <name>` · `pnpm db:types` | New migration · regenerate database types |
| `pnpm theme` | Regenerate the theme from `design/system/tokens.json` (spec 002) |

## How a change ships

Every push runs the checks on GitHub. A merge to `main` builds the images and deploys them to staging (`app-staging.ourcocon.com`). A version tag, once approved, releases the same images to prod. The server setup and day-to-day running are in [docs/operations.md](docs/operations.md).

## Where things are

`apps/app` (Expo, web and iOS) · `apps/mcp` (MCP server) · `packages/` (shared code) · `supabase/` (migrations, policies, tests) · `infra/` (server and deploy) · `design/` · `specs/`. Project rules for Claude Code are in `CLAUDE.md`.
