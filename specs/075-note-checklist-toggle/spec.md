# 075 — Tick checklist items in the drawer, and retire the event checklist

**Status:** Built
**Depends on:** 073, 074 (toolbar, so checklists are easy to write), 041 (edit event sheet), 042 (event page), 044 (MCP calendar tools), 056 (reminder updates), 057 (reminder drawer)
**Updates:** 041, 042, 044 (the event's separate "Bring" checklist is removed; add a Changelog line to each)

## Summary
In the event and reminder drawers, tapping a checklist item ticks or unticks it without opening the editor. The app rewrites `- [ ]` ↔ `- [x]` on that line of the note and saves.

Checklists in notes replace the event's separate "Bring" checklist (042). Existing items move into the event's notes, then the old checklist is removed everywhere: database, app, MCP tools, sync and analytics.

## Functional requirements
- **FR-001** The 073 parser records each checklist item's line number. Tapping the row calls `toggleChecklistLine(notes, line)` (in `lib/notes/`), which flips only that line's box.
- **FR-002** Update the UI straight away, then save the note through the existing event or reminder update path, with the row's `updated_at` as an optimistic lock.
- **FR-003** If the note changed since the drawer loaded (lock fails), reload the note, re-apply the toggle when that line is still the same checklist item text, and save again. Otherwise undo the tick and show the toast "This note changed. Showing the latest version."
- **FR-004** Ticking an item never completes the reminder itself. The reminder only completes with "Mark as done".
- **FR-005** Every member who can see the event or reminder can tick items (same rule as editing notes today).
- **FR-006** Save a toggle like any other edit: it shows in history as done by the member, and the existing undo works.
- **FR-007** Unit tests for `toggleChecklistLine`: first, middle and last line, `[X]` uppercase, Windows line breaks, and a line that is no longer a checklist item.
- **FR-008 Repeating events**: a tick changes the notes shown for that date. When the date has its own notes (an `event_exceptions` override), only that date changes; otherwise the series' notes change, so the tick shows on every date, as the "Bring" list does today. Splitting a series ("this and all future ones") starts the new series' checklist items unticked, as `event_split` does today.

### Retire the event checklist
- **FR-009 Move the data**: one migration appends each event's checklist items to its notes, in `position` order, after a blank line: `- [ ] label` when not done, `- [x] label` when done. An event without notes gets the list alone. If a combined note would go past the notes limit, the migration stops with an error naming the event ids (nothing is dropped silently). Then it drops `event_checklist_items` and the `_stamp_checklist_done` trigger, and removes the `checklist` argument and field from `save_event`, `event_split`, the MCP save function, the event view RPCs, and the activity and assistant-grant table lists.
- **FR-010 App**: remove the "Bring" card from the event page (and the surprise view), the checklist and "+ Add to checklist" from the edit event sheet, the event's checklist from the Gallery, its strings, `event_checklist_items` from sync (`LiveTable`, `apps/app/lib/sync.tsx`), `checklist` from `EventInput` / `ChecklistInput` and from the `EventField` analytics enum. Reuse `ChecklistRow` for the notes' checklist rows if it can match `note-formatting-ui.md`; otherwise remove `ChecklistRow` and `ChecklistAdd` from `@cocon/ui`.
- **FR-011 MCP**: remove `checklist` from `create_event` and `update_event` (input, output and the "scope this" refusal). Replace "Things to bring or do go in checklist, not in notes." with: things to bring or do go in notes as `- [ ] ` lines. Reading an event returns them inside `notes`.
- **FR-012 Docs**: update `design/ui/OC-CalEvent.md` and `design/ui/OC-CalAdd.md` (no Bring card, no checklist field) and spec 042's User Story 1.

## Success criteria
- **SC-001** Tapping an item in your groceries reminder ticks it within 100 ms, and it's still ticked after closing and reopening the drawer.
- **SC-002** If Eva edits the note while you tick an item, neither change is lost silently.
- **SC-003** After the migration, "Baby music class" shows its former "Bring" items as a checklist in its notes, with the same items ticked, and nothing in the app, the MCP tools or the database mentions the old checklist.

## Tracking (PostHog)
| Event | Properties | When |
|---|---|---|
| `note_checklist_toggled` | `entity`, `checked` (true/false), `items_total`, `items_checked` | After the save succeeds |

Removed: `event_checklist_ticked` (replaced by `note_checklist_toggled` with `entity: event`).

## Warnings and errors
- Save failed (offline or server error): undo the tick and show the app's standard "Couldn't save. Try again." toast.

## Needs your attention (defaults chosen)
- Ticking every item does **not** mark the reminder done automatically.
- Ticked items stay where they are (they don't move to the bottom).
- FR-006's "existing undo": the app has no Undo for its own event or reminder edits (only an assistant's can be undone), so a tick has none either. History logs it as the member's edit; tapping the item again undoes it.
- Release order: the migration changes `save_event` and `events_visible`, so iPhones still on today's JS can't load or save events until they get the update. Release the backend to prod, then run `pnpm update:prod` straight away (Gabriel, 2026-11-27).

## Changelog
- 2026-11-27 — First version.
- 2026-11-27 — Gabriel: checklists in notes replace the event's "Bring" checklist (FR-008 to FR-012, SC-003).
- 2026-11-27 — Built. Checklist items tick in place on the event page and in the reminder drawer (`NoteText` `onToggleCheck`, `useNoteChecklist` in `apps/app/lib/note-checklist.ts`), saved through `set_event_notes` (new RPC: that date's own notes, or the series') and `setReminderNotes`. Migration `retire_event_checklist` moves each event's items into its notes (a date with its own notes gets them too), then drops `event_checklist_items` and `_stamp_checklist_done`, and recreates `save_event`, `split_event`, `events_visible` and the activity functions without it. `ChecklistRow` and `ChecklistAdd` are removed; the seed's checklists are in its notes. New event `note_checklist_toggled`; `event_checklist_ticked` and `EventField` `checklist` removed. Deviations:
  - `toggleChecklistLine`, `untickChecklist` and the checklist-line regex live in `packages/schemas/notes.ts` (not `lib/notes/`), because `@cocon/data` unticks a split series and the MCP server uses it too. `lib/notes.ts` uses the same regex.
  - The lock compares the note text as it was seen, not `updated_at`: `event_exceptions` has no `updated_at`, and an edit to another field shouldn't refuse a tick.
  - No Undo toast after a tick (see Needs your attention).
  - Duplicate also unticks the copy's checklist, as it did for the old list. A title suggestion no longer fills a checklist (spec 053 did, for the old list).
  - Each checklist row is a list item holding its checkbox (accessibility check).
