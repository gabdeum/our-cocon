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

### On an iPhone (development build)

Expo Go can't do notifications or Live Activities (spec 046), so the phone runs a **development build**: your own copy of the Our Cocon app, built by EAS, that loads its JavaScript from this Mac. Use a trusted Wi-Fi: the phone reaches local Supabase through this Mac, so anyone on the network can too.

1. Once per phone: `pnpm --dir apps/app exec eas device:create`, then open the link it gives on the iPhone and install the profile (Settings › General › VPN & Device Management). It registers the phone with Apple so it can install the build. Turn on Developer Mode (Settings › Privacy & Security) when the iPhone asks.
2. When native code changes (new native package, `app.json`; CLAUDE.md › Releasing (iOS) lists them) and the first time: `pnpm --dir apps/app exec eas build --profile development --platform ios`. When it's done (10–20 minutes), open its link on the iPhone and install it. It has the same name and bundle id as the TestFlight or App Store app, so it replaces it on that phone (reinstall from TestFlight to go back).
3. Join the same Wi-Fi as the Mac, run `pnpm dev:phone`, open Our Cocon on the iPhone and pick this Mac in its list (or scan the QR code with the Camera app). If the app shows an old version or a config error, run `pnpm dev:phone --clear` to rebuild Metro's cache.
4. To sign in, ask for the link in the app on the iPhone, then open Mailpit in Safari on the phone at the address it prints (`http://<name>.local:54324`). In the newest email, copy the link shown as text under the button (the button can't link to `ourcocon://`), paste it into Safari's address bar and open it in Our Cocon. If the link starts with `http://localhost:8081`, local Supabase was started before spec 046: `pnpm exec supabase stop`, then `pnpm dev:phone` again.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Local Supabase + web app + MCP server |
| `pnpm dev:phone` | Same, but serves the app to the development build on an iPhone on the same Wi-Fi (trusted Wi-Fi only) |
| `pnpm check` | Lint, type check and tests for what changed |
| `pnpm test <path>` | Tests for one file or folder |
| `pnpm test:all` | Every test (needs local Supabase running) |
| `pnpm db:new <name>` · `pnpm db:types` | New migration · regenerate database types |
| `pnpm theme` | Regenerate the theme from `design/system/tokens.json` (spec 002) |

## How a change ships

Every push runs the checks on GitHub. A merge to `main` builds the images and deploys them to staging (`app-staging.ourcocon.com`). A version tag, once approved, releases the same images to prod. The server setup and day-to-day running are in [docs/operations.md](docs/operations.md).

## Where things are

`apps/app` (Expo, web and iOS) · `apps/mcp` (MCP server) · `packages/` (shared code) · `supabase/` (migrations, policies, tests) · `infra/` (server and deploy) · `design/` · `specs/`. Project rules for Claude Code are in `CLAUDE.md`.
