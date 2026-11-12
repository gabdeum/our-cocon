# Feature Specification: Calendar and notifications review (title suggestions, event page, Today, multi-day events, one notification, activity paging)

**Feature Branch**: `053-calendar-notifications-review` · **Status**: Ready · **Depends on**: 002, 004, 026, 028, 035, 036, 037, 041, 042, 050
**Input**: Gabriel's review (2026-11-12). Events: (1) suggest event titles from past events, (2) people above the title next to the type tag, with the notes shown under it, (3) "Today" in the month view puts today's week on the second row, (4) start and end dates for multi-day events. General: (5) one kind of notification for confirmations and errors, with a round Undo and a round ✕, (6) Activity shows the 20 latest and "Show more" works.
**Design**: UI specs `OC-CalAdd`, `OC-CalEvent`, `OC-CalMonth`, `CalHeader`, `OC-Activity`; components `Toast`, `StatusBanner`; `Patterns.md`. The screens (`design/screens/*.dc.html`) are not redrawn: where a screen and its UI spec differ on these points, the UI spec wins.
**Not in scope**: suggestions from assistants' history or other families; a range picker drawn on the grid; a notification centre or history.

## User Scenarios & Testing

### User Story 1 — Titles we use again (P1)
**Acceptance**:
1. **Given** the family had "Swim" every Saturday for months and "Swimming party" once, **When** I type "sw" in "What's happening?", **Then** a row of pills scrolls under the field: "**Swim** · Morning" first, then "**Swimming party** · All day".
2. **Given** I pick "Swim", **Then** the title, type, place, time of day, who, who takes, reminder, visibility and checklist (unticked) are filled as on the latest "Swim", the day stays the one I picked, and More options opens because it holds values.
3. **Given** I type "party", **Then** "Swimming party" still shows (a word starts with it), after any title that starts with "party".
4. **Given** Eva's private "Therapy", **Then** it never appears in my suggestions; a surprise hidden from me neither.
5. **Given** I keep typing past every match, **Then** the list goes away; nothing else changes.
6. **Given** ten "Swim" mornings and two "Swim" at 17:30, **Then** I see two pills, "**Swim** · Morning" and "**Swim** · 17:30", each filling from the latest of its kind.

### User Story 2 — The event page tells who and what first (P1)
**Given** "Baby music class" for James with Gabriel driving and the note "Bring the yellow socks", **Then** above the title: James's dot and "James", the "Social" tag and "Every Saturday"; 16 px of space; the title; the date line; then "Bring the yellow socks". The card's first row reads "Gabriel takes James" with the car.

### User Story 3 — Today lands on today (P1)
**Given** the month view scrolled to March, **When** I tap Today on November 18, **Then** the week of Nov 15–21 is the second row on screen, with Nov 8–14 above it.

### User Story 4 — A trip over several days (P1)
**Acceptance**:
1. **Given** a new event "Grandma visits", **When** I pick Other day › Sat, Oct 31, then Ends › Mon, Nov 2, **Then** "Ends" shows "Mon, Nov 2" and Save adds one event shown as a bar over Oct 31 – Nov 2 in the month, with the toast "Grandma visits added for Sat, Oct 31 – Mon, Nov 2."
2. **Given** I then move the first day to Fri, Oct 30, **Then** the last day moves to Sun, Nov 1 (the length is kept).
3. **Given** I tap the ✕ on the Ends pill, **Then** it's back to "Same day".
4. **Given** I edit that event, **Then** Ends shows "Mon, Nov 2".

### User Story 5 — Every message looks the same (P1)
**Acceptance**:
1. **Given** I delete a grocery item, **Then** the toast at the top reads "Onion removed" with a round Undo button (undo icon only) and a round ✕.
2. **Given** I tap ✕, **Then** the toast goes at once and the delete stays.
3. **Given** saving my calendar settings fails, **Then** a warn toast at the top says so, with ✕; nothing is added to the page, and it stays until I close it.
4. **Given** the Activity screen can't load, **Then** a warn toast says "Couldn't load activity. Check your connection and try again." with a round Try again (retry icon) and ✕.

### User Story 6 — Activity pages through everything (P1)
**Acceptance**:
1. **Given** 45 entries, **Then** Activity shows the 20 latest and "Show more"; tapping it twice shows all 45, each once, and the button is gone.
2. **Given** someone ticks an item while I'm on page 2, **Then** the new entry appears at the top and the entries I already loaded stay.
3. **Given** the next page fails, **Then** a warn toast offers Try again; the 20 already shown stay.

### Edge cases
- **Suggestions:** none in edit mode, nor for "This event only". A suggestion's place or checklist never overwrites what I already typed in More options; the rest of "like last time" does. A member on the suggested event who has left the family is skipped. The conflict check runs on the filled values.
- **Multi-day and repeat:** a multi-day event can repeat weekly, every 2 weeks, monthly or yearly; Daily is hidden when it spans more than one day. Moving to a span over 366 days shows "Pick a last day within a year." and Save does nothing.
- **Multi-day and time of day:** the time of day applies to each day, as the engine already does (spec 034). All day is the usual choice and stays the default.
- **"This event only"** on a repeating event hides Ends (the length belongs to the series).
- **Toasts while a sheet is open:** the toast draws over the sheet (ToastHost), so a failed Save in a sheet shows there and the sheet stays open with what was typed.
- **Two failures in a row:** the newer toast replaces the older (one at a time).
- **Screen readers:** the toast is announced on show; ✕ is "Dismiss", Undo "Undo", retry "Try again". A failure toast stays until dismissed, so there's time to reach it.

## Requirements

### Title suggestions (item 1)
- **FR-001 List:** under "What's happening?" while it holds 1+ characters (new event only): up to 8 pills in one row that scrolls sideways (`role="list"`, aria "Suggestions"; SuggestionPill, Pill README). Each reads "{title} · {start}": the title 14/800 ink, then a dot and when it starts, 14/600 ink-muted: the first slot's name ("Morning"), the start time ("17:30") or "All day". Aria "{title}, {start}".
- **FR-002 Source and ranking:** the family's events the reader can see in full (RLS and `event_view`: no others' private events, no surprises hidden from the reader, no deleted ones). Options are grouped by title (case- and accent-insensitive, trimmed) and start time (first slot, start time, or all day), so one title at one time shows once; each option fills from its latest event. Matching: titles that start with the text, then titles with a word that starts with it. Score per option: the sum over its events of `0.5 ^ (|days between today and starts_on| / 90)`; a repeating series counts once, at its next or latest date. Ties: the latest first.
- **FR-003 Pick:** fills, from the latest event with that title: title (as written there), category, location, time_type with slots or start/end time, members, responsible member, reminder, visibility (only "family" or "private"; a surprise isn't copied) and checklist labels (unticked). The day stays as picked. A filled field the person already changed in this sheet keeps their value. More options opens when it holds any filled value.
- **FR-004 Data:** new RPC `suggest_event_titles(p_query text, p_limit int default 8)` (10 at most) (security invoker, through `event_view` so RLS and privacy apply; `add-table` skill rules for the migration and its RLS tests). It returns `title, score, last_event_id`; the form then loads that event as it does for edit. Debounce 150 ms. Reuse the ingredient typeahead pattern (`apps/app/lib/recipe-ingredients.ts` `suggestIngredients`, `RecipeForm.tsx`, `IngredientsSection.tsx`), including the 200 ms blur delay so a tap lands.

### Event page (item 2)
- **FR-005 Meta row** (replaces spec 050 FR-006's meta row): MemberStack dots and the names ("James and Mia", "Everyone"), then the type tag, "Surprise" and the repeat. It wraps when it doesn't fit. Shown whenever the event has people (always). 16 px below it, then the title.
- **FR-006 Who row:** the card's Who row keeps only the responsible part: "Gabriel takes James" or "Gabriel drives", with the car. Hidden when no one is responsible.
- **FR-007 Notes:** under the date/time line, 8 px below: `notes` at 15/600 `ink-soft`, line-height 1.4, line breaks kept, links not made. After 6 lines it's cut, with the link "Show more" (then "Show less"). Hidden when empty. A surprise's cover keeps its own note card (spec 043).

### Month "Today" (item 3)
- **FR-008:** In the month view, Today scrolls so today's week row is the second row from the top (the row above shows the week before). ‹ ›, the month picker and the first open keep their spec 037 behaviour. Implement in `CalendarScreen.tsx` (`onToday`) and `MonthGrid.tsx` (`jump.index = weekIndexOf(today) − 1`), not by changing `firstWeekOfMonth`.

### Multi-day events (item 4)
- **FR-009 Ends row:** under the When tiles: label "Ends", then a pill "Same day" (selected by default) and a pill "Pick a last day". Picking opens the date sheet "Last day" (DateGrid) on the first day's month, with days before the first day disabled. Once picked, the second pill reads "Mon, Nov 2" with a ✕ (aria "Back to same day") and "Same day" is unselected.
- **FR-010 Draft:** `ends_on = starts_on + span` (the existing `span` in `apps/app/lib/event-form.ts`). Moving the first day keeps the span. The span is at most 366 days; beyond that: "Pick a last day within a year." (warn, `role="alert"`, under the row).
- **FR-011 Copy:** saved toast "{title} added for Sat, Oct 31 – Mon, Nov 2." (no time range for several days), using the event page's "several days" format (OC-CalEvent.md). Conflicts are checked on every day (spec 034 already does).
- **FR-012 Repeat and scope:** Daily is hidden for a span over 0 days (a daily event over several days overlaps itself). "This event only" hides Ends.

### One kind of notification (general item 1)
- **FR-013 Toast:** the one place for confirmations, failures and their actions (Toast README). New layout: the text on the left (15/800, up to 2 lines), then the buttons on the right, 8 apart:
  - **Undo:** a 40 px round button, part of the toast: no shadow, filled with ink at 8% over the toast's colour (`toast-button`, 16% pressed), with a 20 undo icon in the toast's text colour (ink, warn on a failure), aria "Undo".
  - **Try again:** the same with the retry icon, aria "Try again".
  - **✕:** always present, the same round button with `close` (20), aria "Dismiss". It hides the toast and does nothing else.
  - Other single actions ("Open timers") keep a text pill, since an icon can't say them.
- **FR-014 Timing:** 5 s; 8 s with Undo; a failure (warn tone) stays until ✕, its action, or the next toast. One at a time, as today.
- **FR-015 Failures move into the toast:** every message for an action that failed, or a screen or section that couldn't load, is a warn toast with Try again when retrying makes sense. Its copy stays as written in each UI spec. Known places to change:
  - `StatusBanner warn` "save failed": `components/settings/CalendarSettings.tsx` (2), `NotificationSettings.tsx`, `RecipesSettings.tsx`.
  - `Callout warn` failures: `calendar/EventSheet.tsx` (Save failed), `recipes/form/RecipeForm.tsx`, `activity/ActivityScreen.tsx` (load failed), `recipes/RecipeList.tsx`, `groceries/GroceryList.tsx`, `settings/AiConnections.tsx`, `account/OAuthConsent.tsx`, `account/Join.tsx`, and the rest of the ~30 `Callout variant="warn"` uses that report a failure (`grep -rn 'variant="warn"' apps/app/components`).
  - UI specs that said "StatusBanner" for a failure now say "warn toast": OC-SettingsFamily, OC-SettingsRecipes, OC-SettingsNotif, OC-CalSettings, OC-Menu (Recently deleted), OC-Share, OC-CalEvent.
  - A screen that couldn't load shows its skeleton (or what it had) under the toast. Where nothing can be shown at all (a link that couldn't open), the screen keeps its "We couldn't open…" state and the toast isn't needed.
- **FR-016 What stays in the layout:** messages tied to a field ("Give your event a name.", "Pick at least one person."); states that last: offline (StatusBanner warn), "Alex just changed this recipe · Reload", the recipe-deleted notice; hints and tips (Callout tip/info/ai/temp); the conflict callout ("Add anyway?", a question, not a failure).
- **FR-017 Icons:** add `undo` (counter-clockwise arrow) and `retry` (circular arrow) to `design/system/assets/Icons` in the set's stroke style, then `pnpm theme`.

### Activity paging (general item 2)
- **FR-018 Page size:** 20 entries, then the soft button "Show more" (while loading: "Loading…", disabled). It's hidden when the last page had fewer than 20.
- **FR-019 Stable cursor:** `activity_entries` pages by `(created_at, entry_key)` with `p_before_at` and `p_before_key`, so entries sharing a time are never skipped or repeated (migration replacing the function; RLS unchanged). `getNextPageParam` passes both.
- **FR-020 Live updates:** a realtime change refreshes the first page only and never cancels a "Show more" in progress (`refetchType` / `cancelRefetch: false`, or refetch page 1 and merge by key). Undo does the same. Home's latest activity is unchanged.
- **FR-021 Failure:** a failed next page shows the warn toast "Couldn't load more activity. Check your connection and try again." with Try again; loaded entries stay.

## Key Entities
- **Event** (spec 035): unchanged. `ends_on` is now set by the form; `notes` is now shown.
- **Activity entry** (spec 026): unchanged; the function's paging parameters change (FR-019).

## Success Criteria
- **SC-001**: Typing 2 characters shows suggestions within 300 ms on staging.
- **SC-002**: A family with 200 past events gets its most-used title first for its first two letters.
- **SC-003**: No failure message is drawn in a screen's layout (grep for `variant="warn"` and `StatusBanner tone="warn"` leaves only the FR-016 cases).
- **SC-004**: Paging through 45 entries, 10 sharing one timestamp across the 20 boundary, returns each entry exactly once (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `event_created` | gains `days` (1–367) and `used_suggestion` (bool) |
| `event_title_suggestion_picked` | position (1–10), query_length |
| `toast_dismissed` | tone (sage · warn) |
| `activity_show_more` | page (2+) |

No titles or query text are sent (constitution: no user content).

## Warnings and errors
- "Pick a last day within a year." (FR-010)
- "Couldn't load more activity. Check your connection and try again." (FR-021)
- Every other failure keeps its copy and moves into the toast (FR-015).

## Needs your attention
- **Ranking numbers are guesses:** a 90-day half-life and 8 pills. Adjust if suggestions feel stale or noisy.
- **"Like last time" copies a lot:** who and time of day too, as decided. If that surprises people (a one-off with someone else), drop those two from FR-003.
- **Failures stay until closed** (FR-014), so ✕ matters. If that feels heavy, give them 10 s instead.
- **Warn is orange-brown, not red:** the toast's failure tone is `warn-soft` / `warn` (#FFE3C2 / #8A4B00). This spec keeps it; say so if you want a real red (a new `danger-soft` token).
- **Screens not redrawn:** OC-CalAdd, OC-CalEvent and the toast in OC-CalDay still show the old layout; the UI specs are the source until they're updated.
- **iPhone release:** the new icons go through `pnpm theme`. If that touches the native widget theme, the fingerprint changes and a build is needed (`pnpm --dir apps/app exec eas fingerprint:compare`).

## Changes to other specs (apply as changelog lines there)
- **002:** Toast and StatusBanner: round Undo, Try again and ✕; failures stay until closed (FR-013, FR-014).
- **004:** the StatusBanner `warn` tone is only for offline; failures use the toast (FR-015).
- **026:** FR-002's activity list: 20 per page, stable cursor, live updates keep loaded pages, failure toast (FR-018 to FR-021).
- **028:** "See all activity" opens a list of 20 at a time (FR-018).
- **036:** FR-005's "Today" in the month view puts today's week on the second row (FR-008).
- **037:** FR-001 adds Today's scroll (FR-008).
- **041:** FR-001 gains title suggestions (FR-001 to FR-004) and the Ends row (FR-009 to FR-012); "Save failed" is a toast (FR-015); `event_created` gains `days` and `used_suggestion`.
- **042:** the event page shows notes (FR-007); the Who row keeps only who's responsible (FR-006).
- **044:** no change to the tools; `end_date` (already there) and the form now make the same multi-day events.
- **050:** FR-006's meta row now starts with the people (FR-005).

## Changelog
- 2026-11-12: Written from Gabriel's calendar and notifications review (items 1–6). Decided with him: picking a suggested title copies everything like last time except the day; the last day is an "Ends" row under When; every failure, load failures included, becomes a toast.
- 2026-11-12: Built.
  - **Title suggestions:** new RPC `suggest_event_titles` (migration `event_title_suggestions`, with `_fold` for case and accents), read through `events_visible`. The list sits under the title; a pick loads the latest event and fills it through `fromSuggestion`.
  - **Multi-day:** the "Ends" row with a "Last day" date sheet, Daily hidden over several days, the "several days" toast.
  - **Event page:** people in the meta row 16 above the title, the Who row keeps only who takes or drives, notes under the date line with Show more / Show less.
  - **Month Today:** today's week is the second row (`jump.toToday`).
  - **Toast:** round Undo and Try again (new icons `undo`, `retry`) and a ✕ on every toast; failures stay until closed. App `ToastProvider` counts the ✕ (`toast_dismissed`). `useFailureToast` turns each failure into a warn toast: list loads (recipes, groceries, Recently deleted, AI assistants), saves (settings, the event sheet, recipe form, family setup, family settings), share links, delete, add to groceries, the shared page, photo uploads, the cooking Done sheet, sign-in, join and connect.
  - **Activity:** 20 a page, `(created_at, key)` cursor (migration `activity_paging`), "Loading…", a failed page is a toast; `refetchLive` keeps a live change from cancelling "Show more".
  - **Events:** `event_title_suggestion_picked`, `toast_dismissed`, `activity_show_more`; `event_created` gains `days` and `used_suggestion`.
  - **Deviations:**
    - FR-010's "Pick a last day within a year." never shows: the Last day sheet turns off the days past 366 instead.
    - FR-020: a live change refetches every loaded page (so Undo states stay right), never cancelling a "Show more".
    - FR-002/FR-003, from the security review: surprises are never suggested (even to those in on one), and an event that's no longer seen in full when picked fills nothing; so a surprise's secret can't be copied into an event the hidden person sees. A suggestion doesn't copy the event's length either: the day and Ends stay as picked.
    - FR-009: the ✕ is a small round button beside the date pill, not inside it.
    - FR-013: the toast's text wraps rather than stopping at 2 lines (a failure is never cut); actions an icon can't say ("Open timers", "Reload") keep their text button.
    - FR-007: "Show more" appears past 6 lines or 280 characters, a guess (032-later L141).
    - **Kept in the layout** (FR-016): offline, "changed by someone · Reload", a recipe deleted by someone, the calendar conflict, field messages (a taken color too), the photo permission notice, the AI "not connected yet" result, and whole screens that can't open (an expired invite or link, a recipe or event that couldn't load) with their Try again.
  - **Local setup:** both migrations were applied with `psql` because the local database also holds 052's two catalog migrations; `supabase migration up` refuses until both branches are merged. The seed, menu-settings and notifications database tests fail locally for that same reason, on main too.
- 2026-11-12 (Gabriel's follow-up): the toast's round buttons now belong to it: no shadow, a translucent darker fill (new `toast-button` token, IconButton `tint`) and an icon in the toast's text colour. Title suggestions are a sideways-scrolling row of up to 8 pills, "**Swim** · Morning" (new SuggestionPill), one per title and start time, each filling from the latest of its kind (FR-001, FR-002, FR-004, FR-013 updated).
