# StatusBanner

Short live feedback: a confirmation with Undo, and small presence or "screen on" chips.

## Specs

| Variant | Spec |
| --- | --- |
| Confirmation (`oc-status`) | sage, radius 18, min 54 tall, padding 0 8 0 16, 15/800 text; trailing "Undo" button 44 tall, 15/900 underlined; `role="status"` |
| Presence (`oc-presence`) | sage pill, padding 7 12, 13/800, 8 px olive dot: "Mia is shopping" |
| Screen on (`oc-awake`) | sage pill, padding 8 12, 13/800 olive-deep, 16 px screen-on icon: "Screen stays on" |
| Full-screen success | 72 sage disc with a 34 check, title 22/900, body 15/600 muted, Undo link, then two buttons (see Add to groceries) |

## Rules

- Undo stays available for 8 s on banners; for AI changes it stays available for 7 days from the activity feed.
- Never stack two banners. A new one replaces the old.
