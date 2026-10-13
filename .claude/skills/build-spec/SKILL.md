---
name: build-spec
description: Plan and build one Our Cocon spec. Use as /build-spec NNN, in plan mode.
---
Build spec $ARGUMENTS.

Plan (in plan mode):
1. Read `specs/constitution.md`, the decisions in `specs/README.md`, and `specs/$ARGUMENTS-*/spec.md`.
2. For each screen the spec names, read `design/ui/<Screen>.md` and `design/screens/<Screen>.dc.html`, plus their routes in `design/flows.md` and the `design/system/components/<Name>/README.md` of the components used. Read nothing else unless the plan needs it.
3. Plan for this spec only: files to add or change, migrations and RLS, components (reuse `packages/ui` first; new ones go through the `add-component` skill), strings for `apps/app/strings/en.ts`, analytics events from the Tracking table, and the test that proves each acceptance scenario. List anything in the screens you can't match exactly. Stop and wait for approval.

Build (after approval):
4. Implement in small steps. Run `pnpm test <path>` for what you touched; the edit hook handles lint and types.
5. Finish with `pnpm check`. If the change touches auth, RLS, share links, MCP or user data, run the `security-reviewer` subagent and fix its findings. Run the `reviewer` subagent.
6. Add a dated line to the spec's Changelog (what shipped, any deviation). Open the PR titled `NNN <spec name>`, listing new events, deviations and anything for "Needs your attention".
