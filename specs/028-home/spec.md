# Feature Specification: Home

**Feature Branch**: `028-home` · **Status**: Ready · **Depends on**: 020, 026, 033, 035, 041
**Input**: One warm landing screen for the whole household: what's on today and this week, the latest recipe, what to buy, and what AI assistants just did.
**Design**: `design/ui/OC-Home.md`, `design/ui/CalCard.md`; screens `OC-Home`, `CalCard` (today), `OC-CalCardWeek`, `OC-CalCardEmpty`; components Card, SegmentedControl, IconButton, WeekStrip, StatTile, Avatar, TabBar.

## User Scenarios & Testing

### User Story 1 — What's on today (P1)
**Acceptance**: **Given** events today, **Then** right under the greeting the calendar card shows "Today · This week" (Today selected), a birthday banner when one is within 3 days ("Eva’s birthday is on Tuesday"), today's events in time order (color stripe, avatar, title, "Lunch · Grandma’s house", "Now" on the current one) and "Open calendar".

### User Story 2 — Nothing today, or nothing at all (P1)
1. **Given** nothing today but events in the next 6 days, **Then** the card is titled "This week": a 7-day strip with colored dots (empty days muted), up to five rows ("Tue · Yoga · Eva · Evening") and "See all (6 more)".
2. **Given** nothing in the next 7 days, **Then** "No events in the next 7 days. Add one?" with a large "+ Add event", and no footer.

### User Story 3 — See the newest recipe (P1)
**Given** the family has recipes, **Then** the hero card shows the most recently added one with the tag "Latest recipe", its photo, name, time (`total_minutes`, hidden when empty), servings and "N to buy" (its ingredients not on the grocery list yet). Tapping it opens the recipe.

### User Story 4 — Jump to what matters (P1)
**Given** Home, **Then** the tiles show "7 to buy" (groceries) and "32 family recipes", each opening its tab, and both update live.

### Edge cases
- No recipes yet: the hero becomes a soft card "What's for dinner?" with "Add your first recipe" (opens the create form) and an AI hint.
- New family: a friendly empty state for each block, plus "Invite your family".
- A private event of someone else shows as "Busy" in their color; a surprise shows its cover to the person it's hidden from (spec 043).

## Requirements

- **FR-001 Order**: brand row (mark, "Our Cocon", avatar stack of all members — with and without the app — in member colors, max 4 then "+N") → date (olive, 15/700) and greeting → **calendar card** → latest-recipe hero → two stat tiles → latest AI activity.
- **FR-002 Calendar card**: three states (today / this week / empty). "This week" = today plus the next 6 days. The Today · This week toggle is shown only when there are events today and isn't remembered. The olive "+" (44, "Add event") is in every state and opens Add event pre-filled with today (Today) or the next free day (This week). Rows open the event; strip days open Day view; "Open calendar" opens the Calendar tab.
- **FR-003 Reminders**: events with a reminder due today sit at the top of Today with a bell icon (in-app only; phone alerts are V2).
- **FR-004 Birthdays**: yearly Birthday events show in the banner from 3 days ahead, when "Show birthdays" is on (spec 029).
- **FR-005 Hero**: the most recently added recipe, read with `deleted_at is null` (032 L42), with its photo through `useRecipePhotoUrls` like the recipe list (032 L27). Keep its data source behind one function: a later meal-plan feature will put tonight's planned dish there.
- **FR-006 Activity**: the latest AI activity entry for any module (recipe, grocery or event, e.g. "New event: Pediatrician") with Undo or Restore (spec 026); hidden when there's none.
- **FR-007 Greeting**: Good morning (5–12), Hi (12–18), Good evening (18–5).

## Success Criteria
- **SC-001**: Home's numbers and events always match the Groceries, Recipes and Calendar screens (test).
- **SC-002**: Opening the app on a busy day shows today's first event without scrolling at 390 × 844.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `home_hero_opened` | — |
| `home_tile_tapped` | tile |
| `first_recipe_cta_tapped` | — |
| `homepage_calendar_event_tapped` | section (today/week), card_state (today/week/empty) |
| `homepage_calendar_toggled` | to |
| `homepage_calendar_add_tapped` | card_state |

## Warnings and errors
All copy is in the States tables of `design/ui/OC-Home.md` and `design/ui/CalCard.md`. New messages go there and in `strings/en.ts` first.

## Needs your attention
032 L20 (a way into Timers when nothing is running) is still yours to decide; Home is one candidate (a small "Timers" link beside the stat tiles).

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Hero time chip is `total_minutes`, hidden when empty.
- 2026-10-26: Reworked for all modules: calendar card (from the calendar brief), birthdays and reminders; does 032 L27 and L42. Builds after the calendar specs.
