# Feature Specification: Project scaffold and environments

**Feature Branch**: `001-project-scaffold` · **Status**: Ready · **Depends on**: none
**Input**: Monorepo with the Expo app, shared packages and MCP server, deployed to staging and prod on Hetzner from CI, with a self-hosted Supabase stack per environment.

## User Scenarios & Testing

### User Story 1 — A change reaches every environment safely (P1)
A developer merges to `main`; CI tests it and deploys it to staging, and a tagged release promotes the same build to prod.
**Independent test**: merge a visible text change and see it on the staging URL, then promote it.

**Acceptance scenarios**
1. **Given** a PR, **When** CI runs, **Then** lint, type-check and tests must pass before merge is allowed.
2. **Given** a merge to `main`, **When** CI finishes, **Then** the web app and MCP server are live on the staging URLs with that commit's hash visible in a debug footer.
3. **Given** a release tag, **When** it's approved, **Then** prod gets the same build.

### Edge cases
- A failed deploy leaves the previous version running (no partial deploys).
- A database migration that fails rolls back and blocks the deploy.

## Requirements

- **FR-001**: The repo MUST be a pnpm workspace containing `apps/app` (Expo, web and iOS targets), `apps/mcp` (MCP server), `packages/quantity`, `packages/schemas` and `packages/ui` (design-system components).
- **FR-002**: Staging and prod MUST each run a self-hosted Supabase stack (official Docker Compose, pinned release) on Hetzner, with migrations applied from `supabase/migrations` in CI. Only standard Supabase features; every Supabase URL and key comes from environment config, so switching to Supabase Cloud is a config change plus a data move.
- **FR-002b**: Running it safely:
  - Nightly encrypted Postgres backups and a Storage sync to a separate location (Cloudflare R2, free tier), kept 30 days; a restore into staging is tested monthly by a scheduled CI job.
  - Studio and the database port are never public: Studio sits behind Cloudflare Access, Postgres is reachable only from the server and CI over SSH.
  - All default secrets are regenerated; production secrets live in the server's secret store, not a committed or plain `.env`.
  - Server hardening: firewall (80/443 from Cloudflare only, SSH by key), unattended security updates, Supabase releases applied with its update script on staging first.
  - Uptime and disk alerts by email.
- **FR-002d**: One Hetzner Cloud server, `cocon-1` (CX33: x86_64, 4 vCPU, 8 GB RAM, 80 GB disk, Ubuntu 24.04), runs both stacks. Images are built for `linux/amd64`. 8 GB is tight for two Supabase stacks: keep staging lean (drop services it doesn't need, such as analytics and image transforms), add swap, and alert on memory. If it isn't enough, rescale to a larger type (CPU and RAM only, so it can be scaled back).
  - Bootstrap: a provisioning script in the repo, run once from Gabriel's laptop as root (his personal key), creates the `deploy` user with the CI public key (`cocon-deploy.pub`, from his password manager), installs Docker and both stacks, applies the hardening above and disables root and password login. It is idempotent, so it can rebuild the server. After that, CI deploys over SSH as `deploy`; Claude Code never has server access.
- **FR-002c**: `docs/move-to-supabase-cloud.md` MUST describe the move: create the Cloud project, apply migrations, restore the data dump (including auth users), copy Storage, set Auth providers and SMTP, switch environment config and DNS. Members sign in once more and AI assistants reconnect.
- **FR-003**: Secrets MUST come from the CI secret store and server environment, never from committed files.
- **FR-004**: The web app and MCP server MUST be served over HTTPS behind Cloudflare (Full strict, HSTS, security headers): `app.ourcocon.com`, `mcp.ourcocon.com` and `api.ourcocon.com` (Supabase) in prod, and `app-staging`, `mcp-staging` and `api-staging.ourcocon.com` in staging. Supabase Studio is at `studio.` and `studio-staging.ourcocon.com`, behind Cloudflare Access. Hostnames stay one level deep so the free Universal SSL certificate and one `*.ourcocon.com` origin certificate cover them all. The domain is a config value.
- **FR-005**: A GitHub Actions workflow MUST run on every push and every pull request: lint, type-check, the full test suite, a dependency audit (fails on high or critical advisories) and secret scanning (e.g. gitleaks). Merging to `main` requires it to pass.
- **FR-006**: The iOS build MUST be set up for Expo Go and the EAS free tier (no paid EAS features) but not published in V1.
- **FR-007**: Local development MUST run with `pnpm dev` (Supabase CLI + Expo web + MCP server). `env.example` lists every variable; real values live in `.env.local`, which is git-ignored.
- **FR-008**: Scripts MUST match `CLAUDE.md` (`dev`, `check`, `test`, `test:all`, `db:new`, `db:types`, `theme`) and print only failures: ESLint `--quiet`, a minimal Vitest reporter, `tsc --pretty false`. `pnpm check` covers only changed packages.
- **FR-009**: PostHog MUST be wired in the app and MCP server through one typed `track(event, props)` helper backed by `packages/schemas/analytics.ts`; one PostHog project per environment; signed-in users identified by user id with `family_id` as a group.
- **FR-010**: Supabase Auth emails (magic link, invite) MUST be sent through Resend SMTP from a verified `ourcocon.com` sender (SPF, DKIM, DMARC set in Cloudflare).
- **FR-011**: The repo MUST keep the `.claude/` setup (settings, edit hook, subagents, skills) working: the hook calls the same ESLint and TypeScript configs as CI.

## Success Criteria
- **SC-001**: From merge to live on staging in under 10 minutes.
- **SC-004**: A backup restores into staging with all data and photos, in a test run.
- **SC-002**: Promoting to prod needs no manual server commands.
- **SC-003**: A fresh clone runs locally with one documented command.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `app_opened` | platform (web, ios), app_version |

## Warnings and errors
CI and deploy failures report in GitHub only. No user-facing copy.

## Needs your attention
Already set up by Gabriel (2026-10-15), don't redo:
- Cloudflare: ourcocon.com DNS with 8 proxied A records to `cocon-1` (`app`, `mcp`, `api`, `studio` and their `-staging` versions); SSL Full (strict), Always Use HTTPS, TLS 1.2 minimum, HSTS still off; an origin certificate for `ourcocon.com` and `*.ourcocon.com` (in his password manager); Zero Trust Access app "Supabase Studio" on `studio` and `studio-staging` (policy "Only me", one-time PIN); R2 bucket `cocon-backups` with a bucket-scoped token (key, secret and endpoint in his password manager); Email Routing (`hello@ourcocon.com` to Gmail) and DMARC.
- Resend: ourcocon.com verified (DKIM and SPF on `send.ourcocon.com`).
- Hetzner: project `our-cocon`, server `cocon-1` (CX33) with backups, firewall `cocon-web` (22 open, key only; 80/443 from Cloudflare IPv4 ranges only).
- GitHub: public repo; Dependabot alerts, secret scanning and push protection on; environments `staging` (branch `main`) and `production` (tags `v*`, Gabriel as required reviewer), each with `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_PRIVATE_KEY` and `SSH_KNOWN_HOSTS`.
Still to do, when the build asks: tell Gabriel where each remaining secret goes (Supabase keys generated on the server, PostHog project keys for staging and prod, Resend SMTP key, origin certificate, R2 values, CI public key); never ask for secrets in the chat. Branch protection on `main` once the CI check exists. Google sign-in needs a Google Cloud OAuth client before spec 003. The Apple Developer Program is only needed for the iPhone app (V2).
When to move to Supabase Cloud: if updates, backups or outages take more than an hour or two a month, or a restore test fails. The move is described in `docs/move-to-supabase-cloud.md`.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-13: Self-hosted Supabase on Hetzner to start (staging and prod), portable to Supabase Cloud; hosted dev dropped in favour of local.
- 2026-10-13: Staging hosts flattened to `-staging` (free Cloudflare certificate); off-site backups on Cloudflare R2 instead of a Storage Box.
- 2026-10-15: Server is a Hetzner CX33 (x86_64, 8 GB); provisioning bootstrap defined; prerequisites recorded as done.
