# TimerPill

An always-visible pill showing the most urgent running timer; tapping it opens the Timers screen.

## Specs

| Part | Spec |
| --- | --- |
| Pill | 50 tall (48 in headers), radius pill, white, 2 px honey border, `shadow-float`, padding 0 8 0 14, gap 10 |
| Icon | timer 20, olive, stroke 2.4 |
| Name | timer label 15/800, no wrap ("Blind bake") |
| Clock | 17/900 tabular |
| More | "+N" when other timers exist: honey pill, padding 6 10, 13/900 |

## Placement

- Tab screens: centred 10 above the TabBar (the TabBar component reserves 160 px of height for both).
- Recipe page: sticky, centred, 108 from the top.
- Cooking mode: in the header, replacing the "Screen stays on" chip.

## Rules

- Show the running timer with the least time left; if none is running, the paused one with the least time left. Hide the pill when no timers exist.
- `aria-label`: "2 timers running. Open timers".
