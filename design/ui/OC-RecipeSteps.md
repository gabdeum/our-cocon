# OC-RecipeSteps — Recipe page (Steps tab)

Source `screens/OC-Recipe.dc.html` with `tab="steps"` (`screens/OC-RecipeSteps.dc.html` only mounts it) · Route `/recipes/[id]?tab=steps` · Spec 009

## Layout
Same header, version and servings blocks as OC-Recipe, then one StepRow per step, a quick look to find your place (StepCard README › StepRow):
1. Number badge.
2. The step's name (one line, cut short). A step with no name shows its text instead.
3. When the step has a timer, a honey chip on the right with a timer icon and its length ("12:00").
4. A chevron.

The full step (text, temperature check, timer, tip) is in cooking mode; the shared page (OC-SharedView) keeps the full StepCards. "Start cooking" stays in the fixed footer.

## Interactions
| Element | Result |
| --- | --- |
| A step row | → cooking mode at that step (`/recipes/[id]/cook?step={id}&from=recipe`); Exit or Finish returns here |

## Accessibility labels
A step row is a link: "Open step {n} in cooking mode".

## States not drawn
| State | Copy |
| --- | --- |
| A step mentions an ingredient that was deleted | the ingredient's last known name in muted text, no highlight; "an ingredient" when the name is gone too (the form warns, spec 016) |
| A step with no name | the number badge and its text on one line |
| A step added by a variant | listed in its place; numbering never skips |
