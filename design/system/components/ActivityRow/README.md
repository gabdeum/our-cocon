# ActivityRow

One change in the family's activity log, who made it, and Undo when an AI assistant made it: the rows of Home's "Latest activity" card and of the activity list (OC-Home, OC-Activity, specs 026 and 028).

Reference: `design/screens/OC-Home.dc.html` › Latest activity (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Row | min 56, padding 4 0, gap 12, items centred; 1.5 px `line` divider under every row but the last |
| Badge, person | 36 circle in the person's member color, initial 14/900 ink |
| Badge, AI | 36 × 36, radius 12, the person's member color, 2 px olive ring, "AI" 12/900 ink; never shrinks |
| Title | 15/800 ink: "{person} {verb} {thing}" ("Eva added Pumpkin soup", "Gabriel ticked 4 items") |
| Sub-line | 13/600 ink-muted: "{module} · {detail} · via {assistant} · {timeAgo}" ("Calendar · Wed, 10:00 · via Claude · 3 h ago"); "Undone by Gabriel" once undone |
| Action | link (Button README › link) 15/800 olive, padding 10 4, 44 tall: "Undo", or "Restore" for an AI delete. AI rows only; hidden once undone, or after 7 days |
| Layout | rows in a `role="list"`, in a white card on Home or straight on the page (the list) |
| Card (`LatestActivityCard`) | surface-card, radius 26, padding 14 16 10, gap 8, a region named "Latest activity": title 20/900 with the SegmentedControl (pill, 36) "All" · "AI only" on its right, the rows, then the link "See all activity" |

## States

| State | Look |
| --- | --- |
| Default | as above; an AI row with its action |
| Working | action disabled (ink-muted) while the undo runs |
| Undone, restored or too old | no action; the sub-line says who undid it, or keeps its time |

## Rules

- The badge is decorative (hidden from screen readers): the title names the person, the sub-line says "via {assistant}" for an AI change. The action's label names the change: "Undo: Eva added Pumpkin soup".
- Not tappable as a whole: the action is its only control.
- Why it isn't a ListRow with an Avatar: the AI badge is a rounded square with an olive ring, and the trailing link is an Undo, not a chevron. It replaces ActivityCard (one soft card per AI change), which Home and the list no longer use once the family's own changes are logged too.
