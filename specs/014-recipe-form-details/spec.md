# Feature Specification: Recipe form — details

**Feature Branch**: `014-recipe-form-details` · **Status**: Ready · **Depends on**: 004
**Input**: Create and edit a recipe's descriptive fields, in a four-part form shell.
**Design**: canvas `OC-EditBasics`; Patterns.md "Form"; components ScreenHeader (form bar), Progress (form sections), Callout (`--ai`), TextField, MonthPicker, Switch (on ink), Button.

## User Scenarios & Testing

### User Story 1 — Save a family recipe (P1)
**Acceptance**: **Given** I tap New, **When** I enter a name and tap Save, **Then** the recipe is created and opens; every other field is optional.

### User Story 2 — Advanced details (P2)
**Given** "Advanced mode" is on, **Then** prep time, cuisine and source appear inline. The choice is remembered per person.

### User Story 3 — Don't lose my work (P1)
**Given** unsaved changes, **When** I tap Cancel, **Then** a Dialog asks "Discard your changes?" with "Discard" (danger) and "Keep editing".

### Edge cases
- Saving with an empty name: the field shows the warning "Give your recipe a name" and scrolls to it.
- Photo upload fails: a warn Callout "The photo didn't upload. Try again." and the rest still saves.

## Requirements

- **FR-001**: The form shell has 4 sections (Details, Ingredients, Steps, Variants), each reachable from Progress; Save works from any section; "Next: <section>" is at the bottom.
- **FR-002**: Fields: photo, name (required, max 80), short description (max 140, with counter), serves (1–50), total time, best months; advanced: prep time, cuisine (picked from the list in spec 006 FR-003; "Other" leaves it empty), source.
- **FR-003**: Time fields accept "1 h 10", "70 min" or "70" and store minutes.
- **FR-004**: Photos upload to Supabase Storage, resized to a maximum of 2000 px, as JPEG or WebP. After picking a photo, a simple crop step fixes it to the header's shape (13:8, as 390 × 240).
- **FR-005**: The AI hint Callout shows on new recipes only: "Faster: tell your AI assistant “Save Grandma's quiche to Our Cocon”…"

## Success Criteria
- **SC-001**: A first-time user creates a recipe with a name, 3 ingredients and 2 steps in under 3 minutes.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_created` | source (app), has_photo, advanced_mode |
| `recipe_edited` | section |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-EditBasics. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Diet tags removed. Cuisine is a picker over the fixed list instead of free text.
- 2026-10-20: Built. `/recipes/new` and `/recipes/[id]/edit?section=` as full-screen modals with the four-section shell; Details per OC-EditBasics; Ingredients, Steps and Variants are empty until 015–017. Photos go to a private Storage bucket `recipe-photos` at `<family>/<recipe>/<uuid>.jpg` (storage rules and a database check on `photo_path` allow nothing else), shown through 1-hour signed links; they upload right after the crop step (new components PhotoField and PhotoCrop; drag to place, Zoom in/out buttons), so a failed upload never blocks Save. Advanced mode is remembered per person on the device (as 013's choices). Serves starts at 4 on a new recipe (the database default). Also: `PickerField` (Cuisine), `FormScreen`, the ink-card `SettingRow`, `recipe_form` on `offline_banner_shown`, and 032-later L5 (cuisine checked in the database) and L10 (photos in the recipe list, header and steps). Copy written for states the design didn't give (crop step, uploading, photos refused, save and load failures) is in OC-EditBasics.md. Until 017, the edit form has no in-app entry (032 L25).
