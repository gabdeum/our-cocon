# MemberChip

A person (or Everyone / Others) as a toggle chip: calendar filter, Who picker, busy counts.

Reference: `design/screens/CalHeader.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Filter row (header popover) | 52 tall full-width button, dot 34 + name 16/800 + checkbox 26 (olive when on), gap 12, 1.5 px `line` divider |
| Stack (header button) | dots 26, overlap 8, 2 px ring in the button fill, up to 3 |
| Picker (add sheet) | 48 tall, padding 0 16 0 6, white, 2.5 px border: ink when selected, transparent otherwise; dot 34 + name 15/800 |
| Count (day view) | 36 tall, padding 0 12 0 4, white, dot 28 + "{name} {count}" 14/800 |
| Dot | circle in member color, initial 14/900 ink; Everyone "All" 11/900 on `member-everyone`; Others person-outline icon 18 in ink-muted on `member-others` |

## Rules

- Built in `packages/ui` (spec 036): the Filter row (`MemberChip`) and the Stack (`MemberStack`). Picker (041) and Count (039) come with their specs.
- `aria-pressed` drives selection; group has a label ("Show events for", "Who").
- Never color alone: the initial or icon is always visible.
