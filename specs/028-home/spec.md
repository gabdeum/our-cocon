# Feature Specification: Home

**Feature Branch**: `028-home` · **Status**: Ready · **Depends on**: 020, 026, 033, 035, 041
**Input**: One warm landing screen for the whole household: what's on today and this week, the latest recipe, what to buy, and what the family (and their AI assistants) just did.
**Design**: `design/ui/OC-Home.md`, `design/ui/CalCard.md`; screens `OC-Home`, `CalCard` (today), `OC-CalCardWeek`, `OC-CalCardDay` (a day picked), `OC-CalCardEmpty`; components Card, SegmentedControl, IconButton, WeekStrip, StatTile, Avatar, TabBar.

## User Scenarios & Testing

### User Story 1 — What's on today (P1)
**Acceptance**: **Given** events today, **Then** right under the greeting the calendar card shows "Today · This week" (Today selected), a birthday banner when one is within 3 days ("Eva’s birthday is on Tuesday"), today's events in time order (color stripe, avatar, title, "Lunch · Grandma’s house", "Now" on the current one) and "Open calendar".

### User Story 2 — Nothing today, or nothing at all (P1)
1. **Given** nothing today but events in the next 6 days, **Then** the card is titled "This week": a 7-day strip with colored dots (empty days muted), the events grouped by day — the day label once on the left, no lines between events of the same day — up to five rows reading "{title} · {when} · {person}" ("Morning run · 06:30 · Gabriel") and "See all (6 more)".
3. **Given** This week, **When** I tap Wednesday in the strip, **Then** the tile turns olive, the list shows only Wednesday's events laid out like Today (stripe, avatar, title, "10:00 · Gabriel takes James") under "Wednesday, Oct. 28" with "Whole week" to go back, and "+" adds on Wednesday. Tapping Wednesday again also goes back.
2. **Given** nothing in the next 7 days, **Then** "No events in the next 7 days. Add one?" with a large "+ Add event", and no footer.

### User Story 5 — What the family just did (P1)
**Given** Home, **Then** "Latest activity" lists the 4 newest changes by anyone — recipes, groceries, events — newest first ("Gabriel ticked 4 items · Groceries · 2 h ago"); AI changes add "via {assistant}" and Undo or Restore. **When** I tap "AI only", **Then** only AI changes show. The default is All, every time Home opens.

### User Story 3 — See the newest recipe (P1)
**Given** the family has recipes, **Then** the hero card shows the most recently added one with the tag "Latest recipe", its photo, name, time (`total_minutes`, hidden when empty), servings and "N to buy" (its ingredients not on the grocery list yet). Tapping it opens the recipe.

### User Story 4 — Jump to what matters (P1)
**Given** Home, **Then** the tiles show "7 to buy" (groceries) and "32 family recipes", each opening its tab, and both update live.

### Edge cases
- No recipes yet: the hero becomes a soft card "What's for dinner?" with "Add your first recipe" (opens the create form) and an AI hint.
- New family: a friendly empty state for each block, plus "Invite your family".
- A private event of someone else shows as "Busy" in their color; a surprise shows its cover to the person it's hidden from (spec 043).

## Requirements

- **FR-001 Order**: brand row (mark, "Our Cocon", avatar stack of all members — with and without the app — in member colors, max 4 then "+N") → date (olive, 15/700) and greeting → **calendar card** → two stat tiles → latest-recipe hero → Latest activity.
- **FR-002 Calendar card**: three states (today / this week / empty). "This week" = today plus the next 6 days. The Today · This week toggle is shown only when there are events today and isn't remembered. The olive "+" (44, "Add event") is in every state and opens Add event pre-filled with today (Today) or the next free day (This week). Rows open the event; a strip day filters the card to that day (FR-008); "Open calendar" opens the Calendar tab.
- **FR-003 Reminders**: events with a reminder due today sit at the top of Today with a bell icon. Phone notifications for the same reminders come with spec 049.
- **FR-004 Birthdays**: yearly Birthday events show in the banner from 3 days ahead, when "Show birthdays" is on (spec 029).
- **FR-005 Hero**: the most recently added recipe, read with `deleted_at is null` (032 L42), with its photo through `useRecipePhotoUrls` like the recipe list (032 L27). Keep its data source behind one function: a later meal-plan feature will put tonight's planned dish there.
- **FR-006 Latest activity**: a white card "Latest activity" with a small toggle "All · AI only" (default All, not remembered) and the 4 newest entries from the activity log, then "See all activity" (the activity list of spec 026, opened with the same filter). Row: 36 px badge (the person's avatar in their color; AI rows a rounded square "AI" with an olive ring), title "{person} {verb} {thing}" ("Eva added Pumpkin soup", "Gabriel ticked 4 items", "Gabriel added Pediatrician"), sub-line "{module} · {detail} · via {assistant} · {timeAgo}" (detail and assistant only when they apply); AI rows keep Undo / Restore (spec 026). Hidden when the log is empty.
- **FR-008 Week card, one day**: strip tiles are toggle buttons (`aria-pressed`). Picking a day shows only that day, with the Today layout (stripe, 32 avatar, title, "{when} · {place or driver}"), a header "{Weekday}, {Mon.} {d}" ("Today, Sunday, Oct. 25" for today) and "Whole week"; empty: "Nothing planned on Thursday."; "+" adds on that day ("Add event on Wednesday"). Not remembered.
- **FR-009 Activity log for everyone** (extends spec 026 FR-001 and replaces its FR-004 "only AI changes are logged"): app changes are logged too, through the same `activity` table, with `source` = app | assistant: recipes added, edited, deleted, restored; grocery items added (one entry per add action, "added 6 items … from {recipe}"), ticked (grouped per person within 10 minutes) and cleared; events added, changed, deleted. Only assistant entries are undoable. Private events of others log as "added a private event"; surprises aren't logged for the person they're hidden from.
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
| `homepage_calendar_day_picked` | day_offset (0–6) |
| `homepage_activity_filter_changed` | to (all/ai) |

## Warnings and errors
All copy is in the States tables of `design/ui/OC-Home.md` and `design/ui/CalCard.md`. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Hero time chip is `total_minutes`, hidden when empty.
- 2026-10-26: Reworked for all modules: calendar card (from the calendar brief), birthdays and reminders; does 032 L27 and L42. Builds after the calendar specs.
- 2026-11-02: Built. Home in OC-Home's order: brand row with every member's avatar (opens Settings › Family), date and greeting (FR-007, in the home time zone), the calendar card, the latest-recipe hero, the two tiles and the latest AI activity. The card (`layoutCalendarCard`, `apps/app/lib/home.ts`) reads today to today + 6 through `viewFor`, so someone else's private event is "Busy" in their color and opens OC-CalBusy; its rows reuse the agenda's sub-lines. Reminders due today (the morning of or an hour before today's events, the day before tomorrow's) go first with a bell, only for the people the event page says it shows for; birthdays from 3 days ahead are in the banner, not the rows. "+" opens Add event on today, or on the first free day in This week. The hero is `loadHomeHero` (`@cocon/data`, FR-005); "N to buy" counts its ingredients not on the list, matched as "Add to groceries" matches them (a ticked item counts as on the list). The tiles and the hero use the Groceries and Recipes tabs' own queries, so they match and update live (SC-001, tested against local Supabase). New in the design system: `CalCard`, `CalCardBanner` and `WeekStrip`, `EventListRow size="sm"` and `bell`, `WeekEventRow`, a tappable `AvatarStack`, and the cake icon. Copy written for states not drawn: birthdays today or tomorrow, reminder rows, the AI hint under "Add your first recipe", the "Invite your family" card for a family of one, and the strip's screen-reader labels (in OC-Home.md and CalCard.md). Deviations: Home shows one AI activity entry (FR-006; it was 2 in 026) and keeps "See all", the only way into `/activity` (flows.md); the birthday banner opens the Agenda (the screen's link); "Show birthdays" isn't built yet (029), so the banner always shows (032 L111). Also did 032 L27, L42, L72, L90 and L107.
- 2026-11-02: Gabriel's review: week card groups events by day and reads "title · when · person"; tapping a strip day filters the card to that day (FR-008). The AI activity card becomes "Latest activity" for everyone with an "All · AI only" toggle (FR-006); app changes are now logged (FR-009, extends 026).
- 2026-11-02: Built the review changes. Week card (FR-002, FR-008): `layoutCalendarCard` returns the week grouped by day (`WeekEventGroup`, replacing `WeekEventRow`: day label once, divider only between days, "title · when · person") and each strip day in the Today layout (`days`: "Wednesday, Oct. 28", "Nothing planned on Thursday.", "Add event on Wednesday"); WeekStrip tiles are toggle buttons (`aria-pressed`, olive when picked). Picking a day isn't remembered, and switching Today · This week clears it. Event `homepage_calendar_day_picked`. Latest activity (FR-006): 4 entries, "All · AI only" (pill SegmentedControl, All again whenever Home comes back into view), "No AI changes yet.", "See all activity" with the same filter; new components `ActivityRow` and `LatestActivityCard`. Event `homepage_activity_filter_changed`. FR-009 is built with spec 026 (its changelog). Deviations: "Whole week" uses the design-system Link (olive, 44 tall) rather than the screen's olive-deep 36-tall button; a picked day keeps the agenda's tags ("Day 2 of 3", "Surprise") as Today's rows keep "Now"; event rows tapped in a picked day send `section: 'week'`; the All · AI only toggle is the design-system pill SegmentedControl (36 tall, pill radius) rather than the screen's 12-radius track; times read "1 day ago" as on OC-Activity.md, where the screen draws "yesterday".
- 2026-11-02: FR-003 no longer says phone alerts are V2: they come with spec 049.
- 2026-11-05 (050 FR-007, Gabriel's ask): the brand row is pinned when Home scrolls. OC-Home.md updated.
- 2026-11-05 (Gabriel's ask): the two stat tiles sit right under the calendar card, above the latest-recipe hero (FR-001). On iOS the tile number no longer clips: its line box is the font's full height (StatTile). OC-Home.md updated.
