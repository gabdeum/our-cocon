---
name: build-spec
description: Plan and build one Our Cocon spec. Use as /build-spec NNN, in plan mode.
---
Build spec $ARGUMENTS.

Plan (in plan mode):
1. Read `specs/constitution.md`, the decisions in `specs/README.md`, `specs/$ARGUMENTS-*/spec.md`, and the rows of `specs/032-later/spec.md` whose **Do with** names this spec.
2. For each screen the spec names, read `design/ui/<Screen>.md` and `design/screens/<Screen>.dc.html`, plus their routes in `design/flows.md` and the `design/system/components/<Name>/README.md` of the components used. Read nothing else unless the plan needs it.
3. Plan for this spec only: files to add or change, migrations and RLS, components (reuse `packages/ui` first; new ones go through the `add-component` skill), strings for `apps/app/strings/en.ts`, analytics events from the Tracking table, the test that proves each acceptance scenario, and the `032-later` tasks this build will do. List anything in the screens you can't match exactly. Stop and wait for approval.

Build (after approval):
4. Implement in small steps. Run `pnpm test <path>` for what you touched; the edit hook handles lint and types.
5. Finish with `pnpm check`. If the change touches auth, RLS, share links, MCP or user data, run the `security-reviewer` subagent and fix its findings. Run the `reviewer` subagent.
6. Add a dated line to the spec's Changelog (what shipped, any deviation). Update `specs/032-later/spec.md`: remove the tasks this build did, edit any it changed, and add each thing it leaves for later with a priority (P1 before launch, P2 soon, P3 when there's time), **From** this spec and **Do with** the spec that should do it (or none). Add a dated line to its Changelog. Open the PR titled `NNN <spec name>`, listing new events, deviations, `032-later` changes and anything for "Needs your attention".
