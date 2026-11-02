# CalCard

Home's calendar card: what's on today or this week, with Add event and a way into the calendar (spec 028).

Reference: `design/screens/CalCard.dc.html`, `OC-CalCardWeek.dc.html`, `OC-CalCardEmpty.dc.html` (inline styles are the exact values; build with tokens). Behaviour: `design/ui/CalCard.md`.

## Specs

| Part | Spec |
| --- | --- |
| Card (`CalCard`) | surface-card, radius 26, padding 14 16 12, gap 12, no shadow; a region named "Family calendar" |
| Header | left: SegmentedControl "Today" · "This week" (light, items 40 tall) or a 20/900 title ("This week", "Calendar"); right: olive "+" 44 circle, icon 22, "Add event" |
| Banner (`CalCardBanner`) | surface-soft, radius 16, padding 10 12, gap 10, 44 tall at least: 20 px icon in peach-ink (cake for birthdays), text 15/800. A link |
| Today rows | `EventListRow size="sm"` (ListRow README) |
| This week | `WeekStrip`, then up to 5 `WeekEventRow`s and a "See all (N more)" link |
| Empty | 16/700 ink-muted line, then an ink Button 56 tall "+ Add event" |
| Footer | "Open calendar" 15/800 olive with a chevron-right, 44 tall (34 drawn, raised to the touch minimum), 1.5 px `line` divider above, padding-top 10. None in the empty state |

## States

| State | Look |
| --- | --- |
| Offline | "+" at `opacity-dimmed`, not tappable (decision 11) |

## Rules

- The toggle shows only when there's something today, and isn't remembered.
- Rows and strip days are links; the card itself isn't tappable.
