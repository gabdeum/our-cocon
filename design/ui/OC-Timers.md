# OC-Timers — Timers

Source `screens/OC-Timers.dc.html` · Route `/timers` · Specs 010, 011

## Layout
1. Back link "Back" (returns to where you came from).
2. Title "Timers"; right "{running} running · {total} total".
3. One card per timer, newest first:
   - name 17/900; sub-line "{recipe or No recipe} · {Running | Paused | Done!}"
   - "−1", clock 44/900, "+1"
   - progress bar
   - ink button "Pause" | "Resume" | "Add 1 more minute" (done) and soft "Stop" | "Dismiss" (done)
   - card fill: sage while running, surface-soft while paused, honey + 2 px ink border when done
4. TimePresets "Quick kitchen timer": 4 dashed buttons "5 min" · "10 min" · "15 min" · "30 min"; each starts a running "Kitchen timer" of that length (screen reader: "Start a 5 min kitchen timer").
5. Footnote "Timers keep running when you leave the recipe. You'll hear a chime when one ends."

## States
| State | Copy |
| --- | --- |
| None | "No timers running. Start one from any recipe step." (above the quick timers) |
| Paused or done for 3 hours | The timer is cleared from the list without a message (any change to a paused timer starts the 3 hours over) |
| Timer ends anywhere in the app | StatusBanner at the top of any screen: "{name} is done" with "Open timers" |

Timers are personal and live on this device only. The chime is a soft kitchen bell; there are no background/phone alerts in V1.
