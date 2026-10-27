# Our Cocon Constitution

These rules apply to every spec in `specs/`. Specs reference them instead of repeating them.

## I. Product

- Our Cocon is a household app a family shares, managed from the app or from any AI assistant. V1 builds recipes, groceries and the shared calendar; reminders and phone notifications (V2), lists and to-dos (V3), documents and expenses (later) follow. Users are non-technical family members of every age.
- Each area is a module: its own routes, tables, MCP tools (`apps/mcp/tools/<module>/`) and specs. Shared pieces (family, members, activity, Home, Settings, design system) stay module-agnostic, so a new module plugs in without reworking existing ones.
- V1 runs on the web (Expo web); the iPhone app follows from the same codebase (Expo Go in development, then EAS free tier or local Xcode builds for TestFlight).
- Any AI assistant (Claude, ChatGPT, Gemini) can do what the app does through the Our Cocon MCP server.

## II. Stack

- pnpm monorepo, TypeScript strict everywhere. Expo (React Native + web) with Expo Router; styling with NativeWind on the design-system tokens. Supabase for Postgres, Auth, Storage and Realtime; clients talk to Supabase directly and RLS is the security boundary (no separate API server). MCP server in TypeScript (streamable HTTP), authenticated through Supabase's OAuth 2.1 server with dynamic client registration, so assistants act as the signed-in member.
- Calendar rules (slots, recurrence, overlaps, conflicts, labels, visibility) live once in `packages/calendar` (`@cocon/calendar`), used by the app and the MCP server.
- Services: PostHog for product analytics, Resend as Supabase Auth's email (SMTP) provider.
- Supabase is self-hosted on Hetzner (Docker Compose) to start, built to move to Supabase Cloud without code changes: only standard Supabase features, everything in `supabase/migrations`, and every URL and key from environment config. Nothing may depend on a Cloud-only feature.
- Environments: local (Supabase CLI + Expo) for development; staging (pre-prod) and prod each run their own Supabase stack, app and MCP server on Hetzner, with DNS and TLS through Cloudflare. Domain: ourcocon.com.
- Shared logic lives in workspace packages (`@cocon/quantity`, `@cocon/schemas`) used by both the app and the MCP server. No duplicated business rules.

## III. Design

- Every screen follows the **Our Cocon Design System** in `design/system/` (tokens.json, component READMEs, Patterns.md, Extending.md). No hard-coded colours, sizes or fonts.
- New UI that has no component follows the design system's `Extending.md` and is added to the design system.
- Screen references like `OC-Recipe` are artboards on the design canvas, page "Our Cocon · Recipes & Groceries". Their sources are in `design/screens/` and their behaviour in `design/ui/` (see `design/README.md`).
- **Screens are binding.** For every screen a spec touches, the structure, the order of elements and every word (labels, hints, buttons, warnings, empty states, success states) must match `design/screens/<Screen>.dc.html` and `design/ui/<Screen>.md` exactly. Sample data is not copy. Routes and navigation follow `design/flows.md`.
- All user-facing strings live in one strings file (`apps/app/strings/en.ts`), keyed by screen, so copy can be checked against the UI specs in one place.

## IV. Accessibility and clarity (non-negotiable)

- Touch targets are at least 44 × 44, text contrast is at least 4.5:1, every control has a screen-reader label, and screens work at the largest text size.
- Every confusing field has a hint. Every error says what to do next. Destructive actions are confirmed, and AI changes can be undone.

## V. Quantities

- Every amount shown anywhere comes from `@cocon/quantity` (spec 005). Nothing is typed by hand into display strings.
- Counted items show their weight when known ("2 leeks (300 g)"); in ingredient lists, volumes do too, under the amount ("350 ml" · "350 g"). A default size is never named. Temperatures show both scales.

## VI. Data and security

- Everything belongs to a family. Row-level security enforces family membership on every table, and is tested.
- Every write records who made it and through what (app, or the name of the AI assistant) for the activity log (spec 026).
- No secrets in the repo; Claude Code is blocked from reading `.env` files and from destructive commands (`.claude/settings.json`). Inputs are validated with shared Zod schemas on the client, the server and the MCP server.
- Event visibility (private, surprise) is enforced in the database (RLS + the `events_visible` view) and by `@cocon/calendar`'s `viewFor`; UI code never decides visibility on its own. Tests cover the app role and MCP tokens.
- Analytics: events are typed in `packages/schemas/analytics.ts` and listed in each spec's Tracking table. Identify people by user id and family id only; never send names, emails, recipe or grocery text. Shared-recipe pages send no identified events.
- HTTPS only (Cloudflare Full strict, HSTS), security headers on the web app, rate limits on the MCP server and invite and share endpoints.
- Any change touching auth, RLS, share links, the MCP server or user data gets a `security-reviewer` subagent pass before it's done. (No payments in V1.)

## VII. Quality

- A task is done only when lint, type checks and tests pass. Each spec ships as one PR with unit tests for logic, an integration test for its main story (Vitest + React Native Testing Library, against local Supabase for data and RLS), and no regression in earlier specs' tests. Playwright browser tests are deferred.
- Edits are checked by a hook (lint and types on the changed file, silent when clean). Claude runs only related tests while iterating and `pnpm check` before finishing; the full suite, dependency audit and secret scanning run in CI.
- Each spec is built in its own Claude Code session: plan mode first (`/build-spec NNN`), plan reviewed, then implementation (see `specs/README.md`).

## VIII. Specs stay current

- Every spec ends with: Tracking (PostHog events), Warnings and errors, Needs your attention, Changelog. Claude adds a dated Changelog line whenever the build ships or deviates, and puts anything Gabriel must decide under Needs your attention.
- Copy not given by a design is written by Claude for non-technical users (short, friendly, says what to do next) and added to the UI spec and strings file.

## Project-wide decisions

- **Language:** English only in V1. Every string lives in the strings file, so French can be added later.
- **Backend:** self-hosted Supabase on Hetzner, one stack each for staging and prod; move to Supabase Cloud if running it gets too heavy (see spec 001).
- **Hosts:** `app.`, `mcp.` and `api.ourcocon.com` (Supabase) in prod; `app-staging.`, `mcp-staging.` and `api-staging.ourcocon.com` for staging (one subdomain level, so Cloudflare's free certificate covers them). Development is local.
- **Layout:** the web uses the centred mobile layout (max 720 px) in V1. iPad and desktop layouts come later.
- **Theme:** light only in V1.
- **Accessibility:** WCAG 2.2 AA.
- **Calendar:** see "Calendar decisions" C1–C16 in `specs/README.md`.
