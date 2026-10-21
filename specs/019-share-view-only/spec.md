# Feature Specification: Share a recipe as a view-only link

**Feature Branch**: `019-share-view-only` · **Status**: Ready · **Depends on**: 009
**Input**: Send a recipe to anyone. They can read and cook it but not change it.
**Design**: canvas `OC-Share`, `OC-SharedView`; components BottomSheet, Callout (`--info`), TextField, Button, Switch, Stepper, StepCard (read-only).

## User Scenarios & Testing

### User Story 1 — Send to a friend (P1)
**Acceptance**: **Given** the share sheet, **When** I tap "Copy link" (or Message, Email, More), **Then** a link is copied or shared, and a friend without an account opens a read-only recipe page.

### User Story 2 — The friend cooks it (P1)
**Given** the public page, **Then** the friend can change servings, start step timers and read every step, but there's nothing to edit, and no other family data is visible.

### User Story 3 — Take it back (P2)
**Given** "Stop sharing this link", **Then** the link immediately shows "This recipe is no longer shared."

### Edge cases
- Sharing again after stopping creates a new link.
- If "Include variants" is off, the public page shows only the base recipe; if "Include chef's tips" is off, tips are hidden.

## Requirements

- **FR-001**: One active share link per recipe, as an unguessable token (at least 128 bits). The URL looks like `/r/<token>`.
- **FR-002**: The public page is served without authentication through a read-only endpoint that returns only that recipe's shared fields.
- **FR-003**: The public page opens in metric, with a Metric · Imperial toggle under Servings that the viewer can switch.
- **FR-004**: "Save to my Our Cocon" signs the viewer in or up and copies the recipe into their family, crediting "Shared by Gabriel".
- **FR-005**: Public pages are `noindex` and show an Open Graph preview (photo, name, description).
- **FR-006**: Links never expire. They work until someone stops sharing or the recipe is deleted.

## Success Criteria
- **SC-001**: A security test confirms the public endpoint can't return another recipe or any family data.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `share_link_created` | — |
| `share_link_stopped` | days_active |
| `shared_recipe_viewed` | anonymous, no person id |
| `shared_units_toggled` | system |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Share, OC-SharedView. New messages go there and in `strings/en.ts` first.

## Needs your attention
- **Add the Cloudflare rate-limiting rule** before the public launch (docs/operations.md › After the first deploy, step 5; 032-later L2). Until then share links and the invite preview have no request limit.
- **Check a link preview on staging** once deployed: paste an `app-staging.ourcocon.com/r/…` link into iMessage or WhatsApp and see the photo, name and description. The preview is built by nginx (njs), which can't run under `pnpm dev`.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-21: Built. Table `share_links` (one active link per recipe, token made by the database, stopping is one-way and records who and through what; members can't delete links). The public endpoint is a Supabase Edge Function, `shared-recipe`, the only one Caddy lets through; it reads `shared_recipe(token)` (service role only) and signs only that recipe's photos (032-later L26). A deleted recipe's link reads "no longer shared" until it's restored (L38). Open Graph and `noindex` come from nginx (njs) for `/r/*`; the page also sets them. "Save to my Our Cocon" copies the recipe, its photos and variants into the viewer's family through the recipe form's own save, checked with the shared schemas, Source "Shared by {name}"; signed out or without a family it waits through sign-in (at most an hour; cleared on sign-out). Shared-page events go through a separate anonymous PostHog client; the page's timers send nothing, and `app_opened` isn't sent when the app opens on a shared page. New design-system pieces: ShareTile, LinkField, RecipeSummary, PublicScreen, IngredientRow `compact`, SettingRow `disabled`, Link `warn`. Deviations:
  - With variants included, the page shows a Version block like OC-Recipe above Servings.
  - "Not shared": tiles and switches disabled, "Stop sharing this link" hidden.
  - Steps use StepCard (number badge and name) and its timer row ("Start timer" + clock) instead of "{n} · {name}" and "Start {duration} timer".
  - "From the {family} family" drops a leading "The".
  - Metric · Imperial sits inside the Servings card.
  - Not drawn, added to the UI specs: the share sheet's "Couldn't create the link…" and "Couldn't change that…"; the page's loading, couldn't-load, "Saving…" and save-failed states, and "Shared from Our Cocon".
  - SC-001: the answer holds no member ids and no family data; the family and recipe ids appear only inside photo paths, which Supabase's signed links carry anyway and which give no access on their own.
  - The share endpoint also returns total time, prep time, cuisine and best months, so a saved copy keeps them.
- 2026-10-21: After review on dev: "View only" is centred in the header bar; the promo card is a proper ink Card (it showed white, its text unreadable); a small honey "Save to my Our Cocon" also sits under the description, so saving doesn't need a scroll to the end (added to OC-SharedView.md).
