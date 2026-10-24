# OC-Cook — Cooking mode

Source `screens/OC-Cook.dc.html` · Route `/recipes/[id]/cook` · Spec 012

## Layout
1. Fixed header:
   - Soft pill "Exit" with a close icon (left).
   - Right: TimerPill while timers run, then a soft round settings button "Cooking options".
   - Cooking Progress bar (one segment per step, tappable).
   - "Step {n} of {m}" (left, olive 14/900 uppercase) and "Serves {n} · swipe up for next" (right, muted).
2. Scrolling body, one section per step (no "Step {n}" overline: the header's "Step {n} of {m}" already says it): title 28/900, body 21/600 with honey amount highlights, then optionally the dark TimerCard (label "{timer label} timer", −1, clock, +1, honey button), the temperature callout and the chef's tip.
3. End of list: "Bon appétit!" (olive 18/900, centred).
4. Fixed footer: soft "Back" (⅓) and olive "Next step" (⅔). The buttons that leave cooking mode are ink: on the first step Back reads "Exit" with a close icon; on the last step Next reads "Finish" with a check icon.
5. "Cooking options" sheet (BottomSheet, title "Cooking options"):
   - Switch "Screen stays on", hint "Your screen won't lock while you cook" / "Your screen locks as usual". It starts from the "Keep screen on" setting (spec 027) and lasts for this visit.
   - Then the recipe page's "…" options, as in OC-Recipe: "I'm using a kitchen scale", "Scale by an ingredient ›", "Unit converter ›", "Units" Metric · Imperial. They change the steps at once and are remembered for the recipe page too.

## Behaviour
- Next, Back and segment taps scroll smoothly to the step's top (−8 px offset). Scroll position tracking pauses for 700 ms during that scroll.
- Scrolling by hand comes to rest at a step's top, never past it. A step taller than the screen also rests with its end at the bottom of the screen: one swipe reads to the end of the step, the next lands on the next step's top, and the same going back up. A step more than two screens tall has stops a screen apart in between.
- The current step is the last one whose top is above 35% of the body's height. Other steps are dimmed to 0.4.
- TimerCard button labels: "Start timer", "Pause", "Resume", "Done".
- "Finish" closes cooking mode and returns to the recipe.
- Exit, and "Exit" in Back's place on the first step, return to the recipe; timers keep running.
- "Scale by an ingredient" and "Unit converter" close the options sheet and open their sheet over cooking mode; closing it comes back to the same step.

## States
| State | Copy |
| --- | --- |
| Loading | Exit, then skeleton blocks (screen reader: "Loading recipe") |
| Couldn't load | Exit, "We couldn't open this recipe." · "It may have been deleted, or you're offline." · "Try again" (as OC-Recipe) |
| No steps | Closes straight back to the recipe |
| Screen can't stay on (a browser without Wake Lock) | The switch's hint reads "This browser may let the screen lock." |
| "Keep screen on" off (spec 027) | The switch starts off |
| A timer paused or done | Not in the pill (TimerPill README) |
| Opened at a step (Timers › "Go to step") | Starts at that step; a step that's gone starts at step 1. Exit and Finish then open the recipe page |
| Opened at a step from the recipe page's Steps tab | Starts at that step; Exit and Finish go back to the recipe page |

## Accessibility labels
Segments: "Go to step {n}: {name}" ("Go to step {n}" for a step with no name). Settings button: "Cooking options"; the options sheet's close label: "Close cooking options". Timer buttons: "Start timer", "Pause", "Resume", "Done", "One minute less", "One minute more".
