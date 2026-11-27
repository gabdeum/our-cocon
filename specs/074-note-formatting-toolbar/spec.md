# 074 — Formatting toolbar in the notes editor

**Status:** Ready to build
**Depends on:** 073, 041 (edit event sheet), 057 (edit reminder sheet)

## Summary
A small toolbar for the notes field on the edit event and edit reminder screens: Bold, Link, Bulleted list, Numbered list, Checklist. The field stays a plain text input that shows the markdown markers. There is no rich editor and no preview mode.

## Functional requirements
- **FR-001** Add a `NoteFormattingToolbar` component and a `useNoteEditing` hook in `lib/notes/` that holds the text and selection of the notes `TextInput`. Use them on both edit screens.
- **FR-002** iPhone: render the toolbar in an `InputAccessoryView` tied to the notes field. It shows only while that field has focus. Web: render it directly above the notes field, always visible.
- **FR-003** **Bold**: with a selection, wrap it in `**…**`; if it's already wrapped, remove the markers. With no selection, insert `****` and put the cursor in the middle.
- **FR-004** **Link**: open the "Add a link" sheet. Text is pre-filled with the selection. On "Add link", replace the selection (or insert at the cursor) with `[text](url)`. If Text is empty, insert the URL on its own. Validate per 073 FR-004 and add `https://` when the scheme is missing.
- **FR-005** **Bulleted / Numbered / Checklist**: apply to every line the selection touches (the cursor's line if nothing is selected). If all those lines already have that prefix, remove it. Otherwise replace any other list prefix with `- `, `1. ` (renumbered 1, 2, 3…) or `- [ ] `.
- **FR-006** **Enter in a list**: continue the list (`- `, the next number, `- [ ] `). Enter on an empty list item removes its prefix and ends the list.
- **FR-007** Active states: a button is active when the cursor is inside bold text, or on a line of that list type.
- **FR-008** Every toolbar change goes through the input's normal undo (the app's undo on web, shake/three-finger undo on iOS).
- **FR-009** Unit tests for the editing functions: wrap and unwrap, toggling lists across several lines, renumbering, Enter continuing and ending lists, emoji and accented text inside a selection.

## Success criteria
- **SC-001** You can write the groceries checklist and the sourdough steps using only the toolbar and Enter.
- **SC-002** Every toolbar button is reachable with VoiceOver and has a spoken label.
- **SC-003** On a 375px-wide iPhone, the toolbar fits on one line without scrolling.

## Tracking (PostHog)
| Event | Properties | When |
|---|---|---|
| `note_format_applied` | `entity`, `format` (bold/link/bullet/number/check), `action` (add/remove) | A toolbar button changes the text |

## Warnings and errors
- The URL field in the link sheet shows "Enter a web or email address" under it while the value is invalid.
- Notes keep the existing maximum length. If a toolbar change would go past it, do nothing and show the existing length warning.

## Needs your attention (defaults chosen)
- **No preview mode.** You see the formatted result in the drawer after saving.
- **No italic button**, to keep the toolbar to five actions.
- On web, the toolbar is always visible rather than only on focus.

## Changelog
- 2026-11-27 — First version.
- 2026-11-27 — Built. `NoteFormattingToolbar` in `@cocon/ui` (new component, README in design/system/components/NoteFormattingToolbar; icons `link`, `list-bullet`, `list-number`, `checklist`, `keyboard-hide` from the handoff); `NotesField` and the "Add a link" sheet in `apps/app/components/shared`; the edits in `apps/app/lib/note-editing.ts` and the hook in `apps/app/lib/use-note-editing.ts` (one file each: `apps/app/lib` has no folders). Both sheets are also the new event and new reminder sheets, so the toolbar shows there too. Deviations: notes had no length warning, so a change past 5,000 characters shows a new one, "Notes can be up to 5,000 characters."; Bold with the caret inside bold text takes that bold off (the button shows active there) instead of adding `****`; an address with `@` and no scheme gets `mailto:`, anything else that looks like a site `https://`; on the web the toolbar sits between the "Notes" label and the field; its divider `#DCCB9C` is drawn in `line-handle`. FR-008 holds on the web (changes go in through `insertText`, Enter in a list too); on the iPhone toolbar changes may not be undoable (032-later L171).
