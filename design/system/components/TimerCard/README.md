# TimerCard

The large timer, used inside cooking-mode steps (dark) and on the Timers screen (tinted by state).

## Specs

| Part | Dark (cooking mode) | Timers screen |
| --- | --- | --- |
| Card | ink, radius 26, padding 14 16, gap 10 | radius 24, padding 14 16, gap 12; fill sage (running), surface-soft (paused), honey + 2 px ink border (done) |
| Label | "<name> timer" 14/700 on-ink | name 17/900 + "<recipe> · Running" 13/700 |
| Clock | 46/900, letter-spacing −1, tabular, centred | 44/900 |
| −1 / +1 | 48 circles, ink-raised, 15/900 | 48 circles, white at 70% |
| Main action | honey pill 54, 18/900: Start timer · Pause · Resume · Done | ink pill 50, 16/900 (done: "Add 1 more minute") + "Stop" / "Dismiss" soft |
| Progress | — | 6 tall bar, ink fill on 12% ink track |
| Go to step | — | step timers only: olive link 15/800, 44 tall, right of the name and sub-line; opens cooking mode at that step |

## Rules

At zero: sound plus vibration, the card turns honey, and the action becomes "Add 1 more minute". Timers live in an app-wide store, not in the screen.
