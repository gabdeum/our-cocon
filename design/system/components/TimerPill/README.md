# TimerPill

A pill, visible while any timer is running, showing the one with the least time left; tapping it opens the Timers screen.

## Specs

| Part | Spec |
| --- | --- |
| Pill | 50 tall (48 in headers), radius pill, white, 2 px honey border, `shadow-float`, padding 0 14 (0 8 0 14 when the "+N" chip ends it), gap 10 |
| Icon | timer 20, olive, stroke 2.4 |
| Name | timer label 15/800, no wrap ("Blind bake") |
| Clock | 17/900 tabular |
| More | "+N" when other timers are running (paused and done ones aren't counted): honey pill, padding 6 10, 13/900 |
| Hide | After the link part (padding 0 6 0 14), a 1.5 × 24 `line` divider, then a ✕ button 40 × 44 (close 16, ink-muted); the pill's right padding becomes 3 |

## Placement

- Tab screens: centred 10 above the TabBar (the TabBar component reserves 160 px of height for both).
- Recipe page: sticky, centred, 108 from the top.
- Cooking mode: in the header, replacing the "Screen stays on" chip.

## Rules

- Show the running timer with the least time left. Hide the pill while no timer is running (none yet, or all paused or done).
- The name stops at 14 characters with an ellipsis; the clock never truncates.
- `aria-label`: "2 timers running. Open timers", counting running timers only.
- The ✕ ("Hide the timer pill. Timers keep running") hides the pill on every screen without touching any timer; it shows again when a timer starts or finishes, or when the app reopens (spec 011 FR-008).
