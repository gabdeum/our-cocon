# Our Cocon

A household app for families, run from the app or from any AI assistant through MCP. V1 covers recipes, groceries and the shared calendar; reminders, lists, documents and expenses come later as new modules. Rules and decisions: `specs/constitution.md`. Build order: `specs/README.md`.

## Commands (quiet: they print only failures)

| Command | Does |
| --- | --- |
| `pnpm dev` | Local Supabase (CLI) + Expo web + MCP server |
| `pnpm dev:phone` | Same, served to Expo Go on an iPhone (same, trusted Wi-Fi) |
| `pnpm check` | Lint, type check and tests for changed packages. Run before saying a task is done |
| `pnpm test <path>` | Tests for one file or folder while iterating |
| `pnpm test:all` | Full suite, once before opening a PR (CI runs it too) |
| `pnpm db:new <name>` · `pnpm db:types` | New migration · regenerate DB types |
| `pnpm theme` | Regenerate the theme from `design/system/tokens.json` |

## Structure

- `apps/app`: Expo Router (web + iOS). Routes per module (`app/(tabs)`, `app/recipes`, `app/groceries`); all copy in `strings/en.ts`
- `apps/mcp`: MCP server. Tools in `tools/<module>/`
- `packages/ui` (design-system components), `packages/schemas` (Zod, types, analytics events), `packages/quantity` (units and amounts), `packages/data` (Supabase reads and writes shared by the app and the MCP server)
- `supabase/`: migrations, RLS policies and tests, seed
- `design/`: design system, screens and UI specs (read `design/README.md` before UI work)
- `specs/`: one folder per feature

## Conventions

- TypeScript strict. Validate inputs with `packages/schemas`. No business rule written twice.
- UI only from `packages/ui` and theme tokens (NativeWind). Missing component: use the `add-component` skill.
- New table: use the `add-table` skill (family_id, RLS, tests).
- Screens match `design/screens/` and `design/ui/` exactly, copy included.
- Every tracked user action is a typed event in `packages/schemas/analytics.ts`, listed in its spec. Never send user content (names, recipe text, emails) to PostHog.
- Keep changes small and scoped to the spec. Don't touch unrelated files.
- Secrets live only in `.env.local` (never read or print it). The committed template is `env.example`.
- After `pnpm add` in a workspace package, if a module can't be found, run `pnpm install --fix-lockfile` (pnpm can leave broken links).

## Releasing (iOS)

The web app ships through the server (`docs/operations.md`). The iPhone app ships through EAS (Expo's build service, free plan): a **build** is a new binary that goes through TestFlight and App Store review; an **update** sends only the JavaScript to phones already running a compatible build, in minutes, with no review. There is one app, on prod (`production` profile and channel in `apps/app/eas.json`); it is tested in TestFlight before release, and changes are checked on staging (web) and `pnpm dev:phone` first. The full process (first-time setup, TestFlight testing, App Store Connect review and release, rollback) is in `docs/operations.md`, "iPhone app": follow it, or walk Gabriel through it step by step.

| Command | Does |
| --- | --- |
| `pnpm release:ios` | Production build on EAS, uploaded to App Store Connect: lands in TestFlight, not the App Store (build number goes up by itself) |
| `pnpm update:prod` | Publish the committed JS to production phones (refuses with uncommitted changes) |
| `pnpm --dir apps/app exec eas update:roll-back-to-embedded --channel production` | Undo updates: phones go back to their build's own JS |

- **Needs a new build**: adding, removing or upgrading a package with native code (anything `npx expo install` touches, expo SDK upgrades), changes to `app.json` (plugins, permissions, icon, splash, bundle id, scheme), new fonts or assets loaded by a config plugin. A change to the user-facing `version` in `app.json` also needs a build; raise it before each App Store release once one is out.
- **An update is enough**: screens, components, copy, styles, logic in `apps/app` and `packages/*`, images imported from JS.
- When unsure, the runtime version decides: it is a fingerprint of the native project (`runtimeVersion.policy: "fingerprint"`), and an update only reaches builds with the same fingerprint. Compare with `pnpm --dir apps/app exec eas fingerprint:compare`; if it differs from the last build, run `pnpm release:ios`.
- An update's database calls must work against the database the channel's builds talk to: release the backend to prod first.
- Keys live in the EAS environment `production`, never in eas.json.

## Workflow

- One spec per session: run `/build-spec NNN` in plan mode, wait for approval, then build.
- Done means `pnpm check` passes, the spec's Changelog is updated, the PR lists new events, and the PR and final message end with "How to test on dev" (any restart, migration or reset needed first, then the steps; see the `build-spec` skill).
- Changes touching auth, RLS, share links, the MCP server or user data: run the `security-reviewer` subagent before finishing.
- Use subagents (Explore, `reviewer`) for broad searches and reviews to keep this session small.
- Product questions are decided (specs/README.md). Ask only if something truly isn't covered.
- Infra (servers, DNS, CI, secrets): Gabriel is new to it. When explaining, say clearly what each tool, service or term is.
- Keep instructions current: when you repeat a workflow or I correct the same thing twice, propose a CLAUDE.md line or a skill in `.claude/skills/` and tell me.
