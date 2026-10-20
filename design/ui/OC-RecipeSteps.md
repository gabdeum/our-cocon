# OC-RecipeSteps — Recipe page (Steps tab)

Source `screens/OC-Recipe.dc.html` with `tab="steps"` (`screens/OC-RecipeSteps.dc.html` only mounts it) · Route `/recipes/[id]?tab=steps` · Spec 009

## Layout
Same header, version and servings blocks as OC-Recipe, then one StepCard per step:
1. Number badge, step name, optional sage tag "Variant".
2. Body text with highlighted amounts.
3. Optional sage callout: thermometer icon, bold "Temperature check: " + text (e.g. "the center should reach 71 °C (160 °F) and barely wobble.").
4. Optional timer row: button with timer icon + label + clock, then "−1" and "+1".
5. Optional tip: label "Chef's tip" + text.

After the list: the footnote "−1 / +1 changes a timer by a minute, even while it runs.", then "Start cooking".

## Timer button copy
| State | Label | Look |
| --- | --- | --- |
| Not started | "Start timer" | honey |
| Running | "Pause" | olive, white text |
| Paused | "Resume" | honey |
| Finished | "Done!" | honey; clock 00:00. Tapping it clears the timer and the row goes back to "Start timer" |

Before the timer starts, −1 / +1 change the time it will start with (never below 0:30). Once it exists they change the timer itself (spec 010).

## Accessibility labels
"−1": "One minute less" · "+1": "One minute more" · the clock is announced politely at 1 minute left ("1 minute left") and at zero ("{name} is done").

## States not drawn
| State | Copy |
| --- | --- |
| A step mentions an ingredient that was deleted | the ingredient's last known name in muted text, no highlight; "an ingredient" when the name is gone too (the form warns, spec 016) |
| Thermometer setting off (spec 027) | the temperature check callout is hidden |
| Temperature check text | `{temp}` in the saved text marks where the reading goes ("the center should reach {temp} and barely wobble." → "…reach 71 °C (160 °F) and…"); without it, the reading follows the text |
| A step with no name | the number badge and text only |
