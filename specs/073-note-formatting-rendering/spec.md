# 073 — Basic formatting in event and reminder notes

**Status:** Ready to build
**Depends on:** 042 (event page; its notes come from 053 FR-007), 053, 056 (reminders data), 057 (reminders screens, drawer)

## Summary
Event and reminder notes stay plain text in the database (`notes` columns, unchanged) and render a small markdown subset in the drawers: bold, italic, links, bulleted, numbered and checklist lists. Everything else shows as typed. The notes lose their white box and sit on the drawer at full width.

## Functional requirements
- **FR-001** Add a shared `NoteText` component (iOS + web) that takes a notes string and renders it as `design/ui/note-formatting-ui.md` says. Use it in the event drawer and the reminder drawer.
- **FR-002** Parse with a small in-house parser in `lib/notes/` (no markdown or HTML library). It returns blocks (`paragraph`, `boldLine`, `bullet`, `number`, `check`) with inline spans (`text`, `bold`, `italic`, `link`). Rendering uses native `Text`/`View` only. No HTML is ever produced or injected.
- **FR-003** Supported syntax: `**bold**`, `*italic*`, `_italic_`, `[text](url)`, bare `http(s)://` URLs, `- ` / `* ` bullets, `1. ` numbered items, `- [ ] ` / `- [x] ` checklist items, `#`–`######` headings (rendered as a bold line). Any other syntax renders as literal text.
- **FR-004** Links: allow only `http:`, `https:` and `mailto:`. Anything else (e.g. `javascript:`) renders as plain text. Links open in the system browser (`Linking.openURL` / `window.open` with `noopener`).
- **FR-005** Add `notesToPlainText(notes)` in `lib/notes/` and use it everywhere a note shows as a preview (calendar rows, Home cards, search). It strips all markers.
- **FR-006** Drawer layout: remove the white notes box and the "Notes" heading; add the hairline above the notes (UI doc). Edit screens keep their "Notes" field label.
- **FR-007** MCP server: notes are Markdown and the place for everything worth knowing. The `notes` field of `create_event`, `update_event`, `create_reminder` and `update_reminder` says so and lists the conventions (bold, `- [ ]` checklists, `1.` steps, `-` lists, links, `#` headings, tables), that tables, code and diagrams show as typed, and that a change replaces the whole note. The calendar and reminders server instructions and the four tool descriptions repeat it in one line; things to bring or do go in notes as a checklist, not in `checklist`.
- **FR-008** Unit tests for the parser: every supported form, nesting (bold inside a list item, a link inside bold), unclosed markers (`**oops`), unsafe links, Windows line breaks, empty notes, a 5,000-character note.

## Success criteria
- **SC-001** Your real sourdough and groceries reminders render as a numbered list and as a checklist.
- **SC-002** A note with a table or a code block shows the raw text, with no crash and nothing hidden.
- **SC-003** `[x](javascript:alert(1))` renders as plain text.
- **SC-004** Rendering a 5,000-character note in the drawer takes under 16 ms on an iPhone 12.
- **SC-005** No preview anywhere shows `**`, `- [ ]` or `[text](url)` markers.

## Tracking (PostHog)
| Event | Properties | When |
|---|---|---|
| `note_viewed_formatted` | `entity` (event/reminder), `has_bold`, `has_link`, `has_list`, `has_checklist` | Drawer opens on a note that has any formatting. Once per drawer open. |
| `note_link_opened` | `entity`, `scheme` | A link in a note is tapped. Never send the URL. |
| `note_parse_failed` | `entity` | The parser fell back to plain text (Warnings and errors). Never the note. |

## Warnings and errors
- The parser must never throw. On any internal error, fall back to showing the whole note as one plain paragraph and log `note_parse_failed` (no note text in the log).
- If a link can't be opened, show the app's standard toast "Couldn't open that link".

## Needs your attention (defaults chosen)
- **Italic** is rendered but has no toolbar button (assistants write it). Say if you'd rather show it as plain text.
- **Headings** show as a bold line instead of literal `#` characters.
- **Bare URLs** become links automatically.
- **In-house parser**, no library: smaller and safer for this subset.

## Changelog
- 2026-11-27 — First version.
- 2026-11-27 — Gabriel: notes go to 5,000 characters for events and reminders (one `NOTES_MAX`; the reminder tool took 2,000 while the table took 1,000); the event page shows the whole note (053's Show more is gone); the handoff's three off-token colours use the closest tokens (`line-strong`, `member-honey-edge`, `ink-soft`).
- 2026-11-27 — Built. `NoteText` and `NotesSection` in `@cocon/ui` (new component, README in design/system/components/NoteText); the parser in `apps/app/lib/notes.ts` (one file: `apps/app/lib` has no folders), with `safeUrl` and `openNoteLink` for 074; `components/shared/Notes.tsx` ties it to tracking and the toast. Nunito italics (600–900) load with the app. Migration `notes_limit`: both tables to 5,000, a one-date change's override to 24 KB. Deviations: no screen shows a note as a one-line preview, so `notesToPlainText` has no caller yet (032-later L170); table lines and fenced code stay raw; a blank line between numbered items keeps the count; `note_parse_failed` is a PostHog event. SC-004 is measured on the phone (L168). Seed: notes on "Water the plants", "Renew James's passport" and "Football".
- 2026-11-27 — Gabriel: assistants put all knowledge and context in notes, in Markdown (checklists, tables…). FR-007 widened: `NOTES_HELP` and `NOTES_RULE` (`apps/mcp/tools/calendar/input.ts`) in the `notes` fields, the module instructions and the four tool descriptions; `create_event` now sends things to bring to a notes checklist, and the `checklist` field says to leave it out (032-later L169 done).
