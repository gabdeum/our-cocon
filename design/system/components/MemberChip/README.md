# MemberChip

A person (or Everyone / Others) as a toggle chip: calendar filter, Who picker, busy counts.

Reference: `design/screens/CalHeader.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Filter (header) | 44 tall, radius 999, padding 0 14 0 6, white, 2 px border in the member color (Others: `line-handle`), dot 30 + name 14/800, gap 8 |
| Picker (add sheet) | 48 tall, padding 0 16 0 6, white, 2.5 px border: ink when selected, transparent otherwise; dot 34 + name 15/800 |
| Count (day view) | 36 tall, padding 0 12 0 4, white, dot 28 + "{name} {count}" 14/800 |
| Dot | circle in member color, initial 14/900 ink; Everyone "All" 11/900 on `member-everyone`; Others person-outline icon 18 in ink-muted on `member-others` |

## Rules

- `aria-pressed` drives selection; group has a label ("Show events for", "Who").
- Never color alone: the initial or icon is always visible.
