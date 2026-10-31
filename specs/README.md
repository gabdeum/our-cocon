# Our Cocon — V1 specs

Our Cocon is a household app; V1 builds three modules — recipes, groceries and the shared calendar — plus the shared foundation (accounts, family, sync, MCP, Home, Menu). There are 44 specs, plus `032-later`, the living list of deferred tasks. Shared rules (stack, design system, accessibility, quantities, security, project-wide decisions) live once in `specs/constitution.md`; the specs reference it instead of repeating it. Every spec is Ready: there are no open questions.

## What Claude Code reads for each spec

| What | Where | Gives |
| --- | --- | --- |
| Project rules | `CLAUDE.md`, `specs/constitution.md` | Stack, conventions, decisions |
| The spec | `specs/NNN-*/spec.md` | What to build, rules, acceptance tests |
| UI spec per screen | `design/ui/<Screen>.md` | Exact copy, states not drawn, interactions |
| Screen source | `design/screens/<Screen>.dc.html` | Exact structure and labels as designed |
| Flows and routes | `design/flows.md` | Where every button goes |
| Design system | `design/system/` (README.md first) | How every component looks |

Screens are binding (constitution III): structure and wording must match the UI spec and screen source.

## How to run a spec with Claude Code

1. Once: copy `CLAUDE.md`, `.claude/`, `specs/` and `design/` into the repo root.
2. For each spec in build order, start a fresh Claude Code session on a branch named like the spec folder (e.g. `008-recipe-page-ingredients`).
3. Switch to plan mode (Shift+Tab) and type `/build-spec 008` (the spec number). The skill tells Claude exactly what to read, so the session stays small.
4. Read the plan. Approve it, or say what to change. It then builds, runs `pnpm check`, the review subagents and updates the spec's Changelog.
5. Check the screens against `design/screens/` in the browser, merge, and move to the next spec.

## Claude Code setup in `.claude/`

| File | Does |
| --- | --- |
| `settings.json` | Blocks reading `.env` and key files, and destructive commands (force push, `rm -rf`, remote DB push/reset); allows the quiet check commands without prompting |
| `hooks/check-file.sh` | After every edit: lint and type-check that file's package, silent when clean, errors only otherwise |
| `agents/security-reviewer.md` | Security pass for auth, RLS, share links, MCP and user data changes |
| `agents/reviewer.md` | Checks the build against the spec, screens, copy and events (runs on a cheaper model) |
| `skills/build-spec`, `add-component`, `add-table` | Repeated workflows, so they're never re-explained |

No MCP servers are configured for Claude Code; add one only when a spec needs it.

## Build order

| Order | Spec | Needs | Screens |
| --- | --- | --- | --- |
| 1 | 001 Project scaffold and environments | — | — |
| 2 | 002 Design system package and app shell | 001 | TabBar |
| 3 | 003 Accounts and family | 001, 002 | OC-SettingsFamily |
| 4 | 004 Data model, security and sync | 003 | — |
| 5 | 031 Ingredient catalog | 004 | — |
| 6 | 005 Quantity engine | 001, 031 | — |
| 7 | 006 Recipe list and search | 002, 004 | OC-Recipes |
| 8 | 007 Recipe filters | 006 | OC-Filters |
| 9 | 008 Recipe page: header, version, servings, ingredients | 005, 006 | OC-Recipe |
| 10 | 009 Recipe page: steps | 008 | OC-RecipeSteps |
| 11 | 010 Timers engine | 002 | — |
| 12 | 011 Timer pill and Timers screen | 010 | TabBar, OC-Timers |
| 13 | 012 Cooking mode | 009, 010 | OC-Cook |
| 14 | 013 More options: scale, scale by ingredient, converter | 005, 008 | OC-Recipe, OC-ScaleIng, OC-Units |
| 15 | 014 Recipe form: details | 004 | OC-EditBasics |
| 16 | 015 Recipe form: ingredients | 005, 014, 031 | OC-EditIngredients |
| 17 | 016 Recipe form: steps | 009, 015 | OC-EditSteps |
| 18 | 017 Variants | 016 | OC-EditVariants, OC-RecipeSettings |
| 19 | 018 Delete and Recently deleted | 014 | OC-Delete |
| 20 | 019 Share as view-only link | 009 | OC-Share, OC-SharedView |
| 21 | 020 Shared grocery list | 004, 031 | OC-Groceries |
| 22 | 021 Store profiles: need vs. buy | 005, 020, 031 | OC-Groceries, OC-SettingsGroceries |
| 23 | 022 Add from a recipe | 008, 020, 021 | OC-AddGroceries |
| 24 | 023 MCP server: recipes | 004, 005, 017 | — |
| 25 | 024 MCP server: groceries and permissions | 022, 023 | — |
| 26 | 025 AI connections screen | 023 | OC-Connect (the "Add & change events" row comes with 044) |
| 27 | 026 AI activity and undo | 024 | OC-Home |
| 28 | 027 Recipe settings and family defaults | 009, 012 | OC-RecipeSettings, OC-SettingsRecipes |
| 29 | 033 Family members without the app, and member colors | 003 | OC-SettingsFamily, OC-Home (avatars) |
| 30 | 034 Calendar engine package | 001, 033 | — |
| 31 | 035 Events: data model, security and sync | 004, 033, 034 | — |
| 32 | 036 Tab bar v2 and calendar header | 002, 034 | TabBar, CalHeader |
| 33 | 037 Calendar — month view | 035, 036 | OC-CalMonth |
| 34 | 038 Calendar — week view | 035, 036 | OC-CalWeek |
| 35 | 039 Calendar — day view | 035, 036 | OC-CalDay |
| 36 | 040 Calendar — agenda view | 035, 036 | OC-CalAgenda |
| 37 | 041 Add and edit an event | 033, 034, 035 | OC-CalAdd, OC-CalAddMore |
| 38 | 042 Event detail, checklist, duplicate, share and delete | 019, 035, 041 | OC-CalEvent, OC-CalEventDelete |
| 39 | 043 Private and surprise events | 035, 041, 042 | OC-CalAddMore, OC-CalBusy, OC-CalSurprise |
| 40 | 044 MCP server — calendar tools and permission | 023, 024, 025, 035 | OC-Connect |
| 41 | 028 Home (all modules) | 020, 026, 033, 035, 041 | OC-Home, CalCard, OC-CalCardWeek, OC-CalCardEmpty |
| 42 | 029 Menu (apps and settings) and the settings pages | 018, 021, 025, 027, 033, 034, 036 | OC-Menu, OC-SettingsFamily, OC-SettingsGroceries, OC-CalSettings |
| 43 | 030 Accessibility and hints pass | all | all |
| 44 | 045 iPhone sign-in (email link that opens the app, Google, Apple) | 003, iOS release setup | OC-Welcome |
| — | 032 Later: deferred tasks, by priority | — | — |

Specs 001–027 finish recipes and groceries. The calendar (033–044) comes next; Home (028), the Menu (029) and the accessibility pass (030) are built last because they span every module.

032 is a living list, not built in one go: each task names the spec that does it (its plan picks it up), and every build adds, edits or removes its rows.

## Decisions

All 34 open questions are answered. The specs, UI specs and screens already reflect these; this list is the summary.

| # | Area | Decision |
| --- | --- | --- |
| 1 | Language | English only in V1; all copy in one strings file so French can come later |
| 2 | Backend | Self-hosted Supabase on Hetzner to start (staging, prod); portable to Supabase Cloud |
| 3 | Layout | Centred mobile layout on web (max 720 px); iPad and desktop later |
| 4 | Hosts | `app.`, `mcp.`, `api.ourcocon.com`; `-staging` suffix (`app-staging.`); development is local |
| 5 | CI | GitHub Actions: lint, type check, tests, dependency audit and secret scan on every push and PR |
| 6 | Theme | Light only |
| 7 | Accessibility | WCAG 2.2 AA |
| 8 | Sign-in | Email magic link and Google in V1; Apple added with the iPhone app (V2) |
| 9 | Roles | Everyone in the family can edit |
| 10 | Families | One family per person |
| 11 | Offline | Read-only banner; no queued edits |
| 12 | Cups | US cups only |
| 13 | Recipe sort | Most recently added first |
| 14 | Photos | Simple crop to the header shape |
| 15 | Parsing | No French ingredient parsing in V1 |
| 16 | Variants | Change only ingredients and steps |
| 17 | Delete | Any family member; 30 days to restore |
| 18 | Timers | Personal, on your device |
| 19 | Background alerts | V2 |
| 20 | Timer sound | Soft kitchen-bell chime |
| 21 | Finish cooking | Just closes |
| 22 | Home hero | Latest recipe; a calendar will replace it later |
| 23 | Share links | Last until you stop sharing |
| 24 | Shared view units | Opens in metric, with a Metric · Imperial toggle |
| 25 | Defaults | Per family; units can be overridden per recipe |
| 26 | Scale switch | Only affects your device |
| 27 | Account section | Built from existing components |
| 28 | Ticked groceries | Cleared only when "Clear done items" is pressed |
| 29 | Store profiles | US and EU; no UK in V1 |
| 30 | Catalog | English |
| 31 | AI permissions | Per person, Allowed or Not allowed |
| 32 | AI deletes | No approval step; restorable for 30 days |
| 33 | Activity log | AI actions only |
| 34 | Assistant setup steps | Claude Code checks each assistant's current connection steps while building 025 |

Also settled: no pantry (every ingredient starts ticked in "Add to groceries"; untick what you have), and aisles, densities, piece sizes and pack sizes come from the ingredient catalog with family corrections (031).

## Calendar decisions

| # | Area | Decision |
| --- | --- | --- |
| C1 | Scope | Calendar V1 = views, quick add, recurrence, private/surprise, Home card, settings, MCP. Push reminders, external sync, meal-plan slots, holidays and natural-language add come later. |
| C2 | Privacy | Family (default), Private ("Busy" for others), Surprise (the hidden person sees a cover title, time, place and a note). Enforced in the database and in `@cocon/calendar`. |
| C3 | Roles | No kids role; everyone can edit (decision 9). Only the creator changes visibility. |
| C4 | Members | Members can be added without the app (managed by the family); "Who takes {name}?" appears only for them. |
| C5 | Colors | 8 member colors + Everyone (coral, brighter) + Others (light sand, person icon). Always with initials. Replaces the three avatar tones. |
| C6 | Who | "Everyone" and "Others" are always offered in the filter and the Who picker. Others needs no names. |
| C7 | Slots | Early morning, Morning, Lunch, Afternoon, Evening (18:00–22:00). No Night slot; later times use Custom. Family-wide; the owner edits. |
| C8 | Week start | Follows the device region; overridable per member. |
| C9 | Time labels | Slot name only when the event starts at the slot's start, otherwise its start time. Month titles: "October" in the current year; other years "Jan. 2027" under 430 px, "January 2027" above. |
| C10 | Month view | One continuous vertical scroll; sticky weekdays; multi-day events as pills over the grid; no ellipsis on chips. |
| C11 | Week / Day | Week = hour grid with side-by-side overlaps; Day = time-of-day bands; both swipe left/right. |
| C12 | Navigation | Tabs: Home · Calendar · Recipes · Groceries · Menu (Menu = Apps directory + Settings pages, spec 029); the selected tab is a fixed 132 px. |
| C13 | Deletes | Recently deleted for 30 days, plus a 5 s Undo toast. |
| C14 | Offline | Read-only, like the rest of the app (decision 11). |
| C15 | MCP | New permission "Add & change events", per member, default Allowed. |
| C16 | Home and Menu | Built last (028, 029) so they cover recipes, groceries and calendar in one pass. |

### Screens described in words only
These have no drawn screen; their UI spec is the source of truth: sign-in, set up a family and join (OC-Welcome.md), Recently deleted (flows.md), Connect and Manage sheets (OC-Connect.md), the "Add without app" sheet (OC-SettingsFamily.md), the event share sheet and page (OC-CalEvent.md). Your account is drawn on OC-SettingsFamily.
