# EventChip

A one-line event in a month cell.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Chip | 15 tall, radius 4, padding 0 3 (both sides), 10/800 ink, text clipped inside the padding (no ellipsis) |
| Fill | member color; two members split 50/50 (linear-gradient); a 1 px inset outline in the first color's edge token (`member-*-edge`, 3:1 against white, spec 030) |
| Text | Under 430 px wide: the title only ("Surprise"). From 430 px: "{initials} {title}" ("G·J Surprise"); Others contributes no initials |
| Overflow | up to 5 rows per cell; more than 5: 4 rows, then "+N" 10/900 ink-muted |

## Rules

- Private events of others read "Busy" (spec 043).

## From 600 wide (spec 070)

`size="wide"` in the month page: 20 tall, 12/800 text, radius 6, padding 0 6; "+N" (`MoreCount`) 12/900.

## Travel (2026-11-26)

A Travel event (category `travel`, for those who see the event itself) is filled with `event-travel` and outlined in `event-travel-edge`, whoever goes, so a trip reads apart from the people's own events. The `plane` icon, at the text's size, sits 2 px before its text. The same on bars, week blocks (on the top line), day rows and list rows (16 px, before the title).
