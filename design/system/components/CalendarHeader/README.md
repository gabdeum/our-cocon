# CalendarHeader

Shared header for the four calendar views.

Reference: `design/screens/CalHeader.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Row 1 | title 28/900 one line (flex) + soft pill "Today" (44) |
| Row 2 | view button (white pill, label + chevron) · people button (dot stack + "All" / "{n} of {total}" + chevron; sage when filtered) · optional `toggle` (Pill › toggle, 44 round) · spacer · IconButton ‹ › (44, white). Agenda and Day show the "Reminders" toggle in place of ‹ › (`arrows={false}`: Day swipes, Agenda scrolls and has Today); the row has no room for both at 390 px (spec 058). Without ‹ ›, ← → do the same on the web (not while typing or in a sheet), and the title carries "Previous …" / "Next …" as screen-reader actions (VoiceOver's Actions rotor) |
| View menu | Popover: Month · Week · Day · Agenda, 48 px rows, check on current |
| People filter | Popover: "Show events for" + "Show all", MemberChip (row) per member + Everyone + Others with checkboxes |
| Padding | 54 top, 20 sides, 10 bottom; gap 10; total 162 |

## Rules

- Title: the first of the view's formats (longest first) that fits row 1 beside "Today" (262 px at 390), measured; see `design/ui/CalHeader.md` › Titles.
