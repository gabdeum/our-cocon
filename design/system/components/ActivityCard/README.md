# ActivityCard

One change an AI assistant made, who asked for it, and Undo: Home's activity card and every row of the AI activity list (OC-Home, OC-Activity, spec 026).

## Specs

| Part | Spec |
| --- | --- |
| Card | surface-soft (Card `--soft`), radius 20, padding 12 14, gap 12, one row, items centred |
| Badge | 36 × 36, radius 12, surface-card (white), "AI" 12/900 olive; never shrinks |
| Title | 15/800 ink: what changed ("6 items added to Groceries", "New: Pumpkin soup") |
| Sub-line | 13/600 ink-muted: "Added by Alex via ChatGPT · 4 h ago"; "Undone by Gabriel" once undone |
| Action | link (Button README › link) 15/800 olive, padding 10 4, 44 tall: "Undo", or "Restore" for an AI delete. Hidden once undone, or after 7 days |
| Layout | cards stacked with gap 12 |

## States

| State | Look |
| --- | --- |
| Default | as above, with its action |
| Working | action disabled (ink-muted) while the undo runs |
| Undone, restored or too old | no action; the sub-line says who undid it, or keeps its time |

## Rules

- The badge is decorative (hidden from screen readers); the action's label names the change: "Undo: 6 items added to Groceries".
- Not tappable as a whole: the action is its only control.
- Why it isn't an IconTile: the badge is white and 36 px, as drawn on OC-Home; IconTile is 40 px and its tones carry other meanings.
