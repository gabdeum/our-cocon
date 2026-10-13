# OC-Cook — Cooking mode

Source `screens/OC-Cook.dc.html` · Route `/recipes/[id]/cook` · Spec 012

## Layout
1. Fixed header:
   - Soft pill "Exit" with a close icon (left).
   - Right: TimerPill when timers exist, otherwise the sage chip "Screen stays on".
   - Cooking Progress bar (one segment per step, tappable).
   - "Step {n} of {m}" (left, olive 14/900 uppercase) and "Serves {n} · swipe up for next" (right, muted).
2. Scrolling body, one section per step: overline "Step {n}", title 28/900, body 21/600 with honey amount highlights, then optionally the dark TimerCard (label "{timer label} timer", −1, clock, +1, honey button), the temperature callout and the chef's tip.
3. End of list: "Bon appétit!" (olive 18/900, centred).
4. Fixed footer: soft "Back" (⅓) and olive "Next step" (⅔); on the last step the label is "Finish".

## Behaviour
- Next, Back and segment taps scroll smoothly to the step's top (−8 px offset). Scroll position tracking pauses for 700 ms during that scroll.
- The current step is the last one whose top is above 35% of the body's height. Other steps are dimmed to 0.4.
- TimerCard button labels: "Start timer", "Pause", "Resume", "Done".
- "Finish" closes cooking mode and returns to the recipe.
- Exit returns to the recipe; timers keep running.

## Accessibility labels
Segments: "Go to step {n}: {name}". Timer buttons as in OC-RecipeSteps.
