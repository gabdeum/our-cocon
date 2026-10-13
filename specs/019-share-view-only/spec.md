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
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
