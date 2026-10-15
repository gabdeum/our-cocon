# Our Cocon

A household app for families, run from the app or from any AI assistant through MCP. V1 covers recipes and groceries; calendar, reminders, lists, documents and expenses come later as new modules. Rules and decisions: `specs/constitution.md`. Build order: `specs/README.md`.

## Commands (quiet: they print only failures)

| Command | Does |
| --- | --- |
| `pnpm dev` | Local Supabase (CLI) + Expo web + MCP server |
| `pnpm check` | Lint, type check and tests for changed packages. Run before saying a task is done |
| `pnpm test <path>` | Tests for one file or folder while iterating |
| `pnpm test:all` | Full suite, once before opening a PR (CI runs it too) |
| `pnpm db:new <name>` · `pnpm db:types` | New migration · regenerate DB types |
| `pnpm theme` | Regenerate the theme from `design/system/tokens.json` |

## Structure

- `apps/app`: Expo Router (web + iOS). Routes per module (`app/(tabs)`, `app/recipes`, `app/groceries`); all copy in `strings/en.ts`
- `apps/mcp`: MCP server. Tools in `tools/<module>/`
- `packages/ui` (design-system components), `packages/schemas` (Zod, types, analytics events), `packages/quantity` (units and amounts)
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

## Workflow

- One spec per session: run `/build-spec NNN` in plan mode, wait for approval, then build.
- Done means `pnpm check` passes, the spec's Changelog is updated and the PR lists new events.
- Changes touching auth, RLS, share links, the MCP server or user data: run the `security-reviewer` subagent before finishing.
- Use subagents (Explore, `reviewer`) for broad searches and reviews to keep this session small.
- Product questions are decided (specs/README.md). Ask only if something truly isn't covered.
- Infra (server, DNS, CI, secrets): Gabriel is new to it. Explain each step in plain words, guide anything he does himself click by click, verify results yourself, and keep `docs/infrastructure.md` current.
- Keep instructions current: when you repeat a workflow or I correct the same thing twice, propose a CLAUDE.md line or a skill in `.claude/skills/` and tell me.
