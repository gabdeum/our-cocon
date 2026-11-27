# NoteText

A note's formatted text on the event page and in the reminder drawer (spec 073): bold, italic, links, bulleted, numbered and checklist items, headings as a bold line, tables. `NotesSection` puts it under its hairline.

Reference: `design/screens/OC-NoteMarkdown.dc.html` and `design/ui/note-formatting-ui.md` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| NotesSection | full width, 1.5 px `line-strong` hairline on top, 14 below; `role="region"` labelled "Notes" |
| Blocks | 12 apart; a bold line gets 4 more above |
| Paragraph | 15/600 ink, line height 1.5, line breaks kept |
| Bold · italic | weight 900 · Nunito italic of the same weight |
| Link | olive 15/800, underlined, `role="link"`; the caller opens it |
| Bulleted item | 7 px `member-honey-edge` dot, 8 from the top, 10 before the text (15/600, 1.45); items 8 apart |
| Numbered item | 22 px `surface-soft` disc, number 12/900; 10 before the text; items 8 apart |
| Checklist item | min 44 row, gap 12; box 24, radius 7: off 2.5 px `line-dashed` on `surface-card`, on olive with a white ✓; text 15/700 at 1.4, done = strike-through + `ink-soft`; `role="checkbox"` with its state |
| Lists | `role="list"` / `listitem`; dots and numbers hidden from screen readers |
| Table | 1.5 px `line-strong` border and lines, radius 12; header on `surface-soft`, 15/900; cells 15/600 at 1.4, padding 8 × 12, aligned per column; column width = longest cell (64–240, text wraps past it); sideways `ScrollView` when wider than the note; `role="table"`, `row`, `columnheader`, `cell` |

## Rules

- It takes parsed blocks (the app's `lib/notes.ts`), never markdown or HTML: native `Text` and `View` only.
- Numbers come from the item's position, not from what was typed.
- Anything the parser doesn't know (code, quotes, pipe lines without a separator) arrives as a plain paragraph and shows as typed.
- The parser sends no table over 12 columns or 600 cells (it shows as typed).
- Column widths come from the cells' text length, not from measuring, so rows line up the same on iOS and the web.
- Checklist items are not tappable yet (spec 075 adds ticking).
- The handoff's `#EADDB8` hairline, `#C99A1E` dot and `#6B5F43` ticked text are drawn with the closest tokens (`line-strong`, `member-honey-edge`, `ink-soft`).
