# WeekdayPicker

Weekly's "On" days in the add sheet's Repeat (spec 041).

Reference: `design/screens/OC-CalAdd.dc.html` (the "On" grid inside the Weekly box; inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Row | seven equal tiles, gap 4, inside the white repeat card (radius 16, padding 12) |
| Tile | 44 tall, radius 12, letter 15/900; off surface-soft ink, on olive white |

## Rules

- Letters from Sunday ("S M T W T F S"), as drawn; each tile is a toggle labelled with the full day ("Saturday").
- No day picked: the event repeats on its start day's weekday.
