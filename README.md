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

### On an iPhone (Expo Go)

Use a trusted Wi-Fi: the phone reaches local Supabase through this Mac, so anyone on the network can too.

1. Install Expo Go from the App Store and join the same Wi-Fi as the Mac.
2. Sign in to the same free Expo account (expo.dev) on both: `pnpm --filter @cocon/app exec expo login` on the Mac, and the account button at the top of Expo Go on the phone. Expo Go won't open the app otherwise. Once per Mac and phone; `pnpm --filter @cocon/app exec expo whoami` checks the Mac.
3. Run `pnpm dev:phone` and scan its QR code with the Camera app, or enter the `exp://…:8081` address it prints in Expo Go. If the app shows an old version or a config error, run `pnpm dev:phone --clear` to rebuild Metro's cache.
4. To sign in to the app, open Mailpit at the address it prints, copy the link and open it in Safari with `127.0.0.1` changed to the Mac's network name it prints (`<name>.local`). Supabase only sends you back to Expo Go through that name, not an IP address.

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
