# Note formatting — UI (binding)

Applies to the notes in the **event drawer** and the **reminder drawer**, and to the notes field on the **edit event** and **edit reminder** screens. Nothing else changes.

Canvas with the full drawers in context: https://claude.ai/artifact/7Q4JdAPcQvPFsWhbER7eET

## What's new vs placeholder

| Source file | New (build it) | Placeholder (keep as in the app) |
|---|---|---|
| `design/screens/OC-NoteMarkdown.dc.html` | The whole notes section: divider and every formatted block | Sample text |
| `design/screens/OC-NoteEditor.dc.html` | The formatting toolbar, the "Add a link" sheet, the notes field's focused border | Header (Cancel / Edit reminder / Save), Title field, the grey "iOS keyboard" block |

## Notes section in the drawers (change)

- **Remove the white box** around notes. Notes sit on the drawer background (`#FFF8E3`), at full drawer content width (drawer padding 20px each side).
- Above the notes: a 1.5px `#EADDB8` hairline, 14px padding below it.
- **No "Notes" heading** in the drawers: the hairline alone separates the notes from the details above.
- Gap between blocks: 12px. A bold-line block gets 4px extra space above it.
- No notes: keep the current "+ Add a note" link, under the hairline.

## Formatted blocks

| Markdown | Renders as |
|---|---|
| Paragraph | 15px / 1.5, weight 600, `#2A2414`. Single line breaks are kept. |
| `**bold**` | weight 900 |
| `*italic*` / `_italic_` | italic (no toolbar button) |
| `[text](url)`, bare `https://…` | `#5A6820`, weight 800, underlined; opens in the system browser |
| `- item` / `* item` | 7px `#C99A1E` dot, 10px gap, dot top offset 8px; items 8px apart |
| `1. item` | 22px circle `#FFF0C9`, number 12px weight 900; numbers come from position (1, 2, 3…) |
| `- [ ] item` / `- [x] item` | 24px box, radius 7px: empty = 2.5px `#CDBF95` border on white; ticked = `#5A6820` fill + white tick, text struck through in `#6B5F43`. Whole row is the tap target (min 44px). |
| `# Heading` (any level) | A bold line (15px, weight 900). No size change. |
| Anything else (tables, code, quotes, diagrams, HTML) | Plain text, exactly as typed |

One level of lists only. Indented items show as normal items.

## Editor toolbar

- **iPhone:** a 52px bar pinned above the keyboard (`InputAccessoryView`), only while the notes field has focus. **Web:** the same bar directly above the notes field, always visible.
- Background `#FFF0C9`, 1.5px `#EADDB8` top border. Buttons are 48×44, radius 12, icon 22px stroke 2.4.
- Order: **B** (bold), Link, | divider |, Bulleted list, Numbered list, Checklist, then Hide keyboard on the right (iPhone only).
- Active state (the cursor is inside bold text or a list of that type): `#5A6820` fill, white icon.
- Each button has an `aria-label` / `accessibilityLabel`: "Bold", "Link", "Bulleted list", "Numbered list", "Checklist", "Hide keyboard".

## "Add a link" sheet

- Bottom sheet in the app's drawer style. Title "Add a link" (22px, weight 900).
- Fields: **Text** (pre-filled with the selected text) and **Link** (placeholder `https://`, URL keyboard, focused first if Text is already filled).
- Buttons: Cancel (`#FFF0C9`) | Add link (`#5A6820`). Add link stays disabled until Link is a valid http(s) or mailto address. `example.com` with no scheme gets `https://` added.

## Previews

Anywhere a note shows as one line (calendar rows, Home cards, search results): strip all markers, show plain text.
