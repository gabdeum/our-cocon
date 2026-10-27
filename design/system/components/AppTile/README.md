# AppTile

A part of the app in the Menu's Apps directory.

Reference: `design/screens/OC-Menu.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Tile | `<a>`, min 118 tall, white, radius 22, padding 14 12, column, gap 10 |
| Icon | 44 square, radius 14, `surface-soft`, 24 px ink icon (same icon as the tab) |
| Text | name 16/900; detail 13/700 ink-muted, live ("3 today", "48 recipes", "7 to buy") |
| Grid | 3 columns, gap 10; wraps to new rows |

## Rules

- The accessible name is the name plus the detail ("Calendar, 3 today").
- The list of apps is data; adding an app is one entry.
