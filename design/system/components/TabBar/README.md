# TabBar

The floating dark navigation pill with four destinations: Home, Recipes, Groceries, Settings.

## Specs

| Part | Spec |
| --- | --- |
| Bar | 68 tall, radius 34, ink, padding 8, gap 4, `shadow-nav`; 16 from the sides, 26 from the bottom (plus the safe area) |
| Item | flex 1, radius 26, icon 24 in `on-ink`, label hidden |
| Active item | flex 2.2, honey fill, ink icon + label 15/800, gap 8 (`aria-current="page"`) |
| Icons | home, recipes, groceries, settings (Assets › Icons) |
| Container | 160 tall when timers exist (TimerPill above it), 100 otherwise; screens pad their content 180 at the bottom |

## Rules

- Shown on the four tab screens only; hidden on pushed screens, sheets, forms and cooking mode.
- Icon-only items carry `aria-label`.
