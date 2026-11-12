# OC-Cook — Cooking mode

Source `screens/OC-Cook.dc.html` · Route `/recipes/[id]/cook` · Specs 012, 051

## Layout
1. Fixed header:
   - Round ✕ (IconButton `--round`, label "Leave cooking mode, stays in progress", spec 050) (left).
   - Right: TimerPill while timers run, then a round settings button "Cooking options" (IconButton `--round`, like the ✕).
   - The header's padding (safe area, at least 52, then 16 at the sides) matches the loading state's TopBar, so the ✕ doesn't move when the steps appear.
   - Cooking Progress bar (one segment per step, tappable).
   - "Step {n} of {m}" (left, olive 14/900 uppercase) and "Serves {n} · swipe up for next" (right, muted).
2. Scrolling body, one section per step (no "Step {n}" overline: the header's "Step {n} of {m}" already says it): title 28/900, body 21/600 with honey amount highlights, then optionally the dark TimerCard (label "{timer label} timer", −1, clock, +1, honey button), the temperature callout and the chef's tip.
3. End of list: "Bon appétit! Tap Done cooking to log it." (olive 18/900, centred).
4. Fixed footer: soft "Back" (⅓) and olive "Next step" (⅔). Back always reads "Back"; on the last step Next reads "Done cooking" (olive, not ink).
5. "Cooking options" sheet (BottomSheet, title "Cooking options"):
   - Switch "Screen stays on", hint "Your screen won't lock while you cook" / "Your screen locks as usual". It starts from the "Keep screen on" setting (spec 027) and lasts for this visit.
   - "Edit step {n}" › (ListRow with a chevron, the current step): closes the sheet and opens the recipe form (full-screen) on Steps with that step open. A step a chosen variant adds or changes opens that variant in Variants instead, since it decides what the step says. Saved or cancelled, it comes back to cooking mode at the same step.
   - Then the recipe page's "…" options, as in OC-Recipe: "I'm using a kitchen scale", "Scale by an ingredient ›", "Unit converter ›", and "Units" Metric | Imperial. They change the steps at once; the kitchen scale is remembered for the recipe on this device, the units only for this visit (shared with the recipe page under it, spec 051).

## Behaviour
- Next, Back and segment taps scroll smoothly to the step's top (−8 px offset). Scroll position tracking pauses for 700 ms during that scroll.
- Scrolling by hand comes to rest at a step's top, never past it. A step taller than the screen also rests with its end at the bottom of the screen: one swipe reads to the end of the step, the next lands on the next step's top, and the same going back up. A step more than two screens tall has stops a screen apart in between.
- The current step is the last one whose top is above 35% of the body's height. Other steps are dimmed to 0.4.
- TimerCard button labels: "Start timer", "Pause", "Resume", "Done".
- Cooking mode runs inside the recipe's cook (spec 051): opening it resumes the cook in progress, at its step, with its servings and version; with none, it starts one at step 1 ("Start over" cancels the old one first). Offline, it still cooks, but nothing is saved.
- The step is saved to the cook 2 s after it settles, and on leaving.
- ✕, and Back on step 1, leave cooking mode and return to the recipe; the cook stays in progress and timers keep running.
- "Done cooking" logs the cook as done and returns to the recipe page, which opens the Done sheet (OC-CookDone). When it can't save, it returns to the recipe with the cook still in progress.
- "Scale by an ingredient" and "Unit converter" close the options sheet and open their sheet over cooking mode; closing it comes back to the same step.

## States
| State | Copy |
| --- | --- |
| Loading | TopBar with the round ✕ "Leave cooking mode, stays in progress", then skeleton blocks (screen reader: "Loading recipe") |
| Couldn't load | TopBar with the round ✕, then "We couldn't open this recipe." · "It may have been deleted, or you're offline." · "Try again" (as OC-Recipe) |
| No steps | Closes straight back to the recipe |
| Screen can't stay on (a browser without Wake Lock) | The switch's hint reads "This browser may let the screen lock." |
| "Keep screen on" off (spec 027) | The switch starts off |
| A timer paused or done | Not in the pill (TimerPill README) |
| Opened at a step (Timers › "Go to step") | Starts at that step; a step that's gone starts at step 1. ✕ and "Done cooking" then open the recipe page |
| Opened at a step from the recipe page's Steps tab | Starts at that step; ✕ and "Done cooking" go back to the recipe page |
| Opened at a step while the page is still laying out (fonts loading, steps above growing) | Keeps landing on that step for 2 s, until the person scrolls |

## Accessibility labels
Segments: "Go to step {n}: {name}" ("Go to step {n}" for a step with no name). Settings button: "Cooking options"; the options sheet's close label: "Close cooking options". Timer buttons: "Start timer", "Pause", "Resume", "Done", "One minute less", "One minute more". After Next, Back or a segment: "Step {n} of {total}: {name}" ("Step {n} of {total}" without a name; spec 030). With Reduce Motion the steps jump instead of scrolling, and the others dim at once.

## Changelog
- 2026-11-05 (050): "Cooking options" is a round IconButton; the header lines up with the loading state's TopBar.
- 2026-11-10: "Edit step {n}" in the options sheet opens the recipe form at the current step.
- 2026-11-12 (051): leaving keeps the cook in progress (✕ "Leave cooking mode, stays in progress"; Back on step 1 leaves too); the last step's "Done cooking" logs it and opens the Done sheet; "Exit" and "Finish" removed; "Units: {x}" link row in the options sheet.
