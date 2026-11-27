# NoteFormattingToolbar

The notes field's formatting bar on the event and reminder sheets (spec 074): Bold, Link, Bulleted list, Numbered list, Checklist, and Hide keyboard on the iPhone. The field stays plain text; the bar adds or removes the markers.

Reference: `design/screens/OC-NoteEditor.dc.html` and `design/ui/note-formatting-ui.md` › Editor toolbar (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Bar | 52 tall, `surface-soft`, 1.5 px `line-strong` line on top, padding 0 6, buttons 2 apart; `role="toolbar"` labelled "Formatting" |
| Button | 48 × 44, radius 12, no fill; pressed `surface-soft-pressed`; focus ring |
| Bold | the letter **B**, 19/900 ink |
| Icons | `link`, `list-bullet`, `list-number`, `checklist`, 22, ink, stroke 2.4 |
| Divider | 1.5 × 24 `line-handle`, 4 each side, between Link and Bulleted list; hidden from screen readers |
| Active | `olive` fill, `on-olive` B or icon; `aria-pressed="true"` |
| Hide keyboard | `keyboard-hide` 22 in `ink-muted`, pushed to the right; iPhone only |

## Where it goes

- **iPhone:** pinned above the keyboard (`InputAccessoryView` tied to the notes field), so it shows only while that field has focus.
- **Web:** directly above the notes field, always visible.

## Rules

- Every button has a spoken name: "Bold", "Link", "Bulleted list", "Numbered list", "Checklist", "Hide keyboard".
- Bold is active when the caret is inside bold text; a list button when the caret's line is that kind of item; Link while the "Add a link" sheet is open.
- It only draws and reports taps: the app's `lib/note-editing.ts` makes the edits.
- The handoff's `#DCCB9C` divider is drawn with the closest token, `line-handle`, and its `#EADDB8` line with `line-strong`.
- On a 375-wide iPhone the six buttons and the divider fit on one line (about 360).
