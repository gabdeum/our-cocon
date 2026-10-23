# OC-EditSteps — Recipe form: Steps

Source `screens/OC-EditSteps.dc.html` · Route `…/edit?section=steps` · Spec 016

## Layout
1. Title "Steps".
2. Collapsed step cards: drag handle, number badge, name (or the text's first line), and a pill on the right for each add-on, in the toggles' order: "{n} min", "Temp check", "Tip", "Photo". Pills that don't fit wrap onto a second line, still on the right. (The drawn screen shows the temperature check as a sage line under step 5; Gabriel chose pills instead, 2026-10-21.)
3. The expanded step (2 px olive border, one at a time):
   - drag handle, number + "Step name" input
   - "Instructions" editor with ingredient chips (sage)
   - hint "Type @ or tap below to insert an ingredient. Its amount fills in and scales by itself."
   - typing "@" lists matching ingredients that no step mentions yet ("Ingredient suggestions"; each ingredient goes in one step); picking one puts its chip in
   - temperatures in the text, when there are any: "Is it the oven, or a thermometer reading?" with "Oven" · "Thermometer" for each (see Temperatures)
   - chips "+ {ingredient}" for ingredients not yet used in any step
   - "Preview" box showing the rendered text with bold amounts
   - "Add to this step": toggles "Timer", "Temperature check", "Chef's tip", "Photo" (olive with "✓" when on)
   - Timer: "Timer" (e.g. "8 min") and "Timer label" (defaults to the step name)
   - Temperature check: "Temperature" + °C/°F toggle, hint "For a thermometer reading. Oven temperatures go in the instructions.", then "What to check" (placeholder "center reaches", hint "Type {temp} where the reading goes, or it goes at the end."), and the line "Temperature check: center reaches 71 °C (160 °F)"
   - Chef's tip: textarea, placeholder "Something you wish you'd known the first time", max 200, counter "{n} / 200"
   - Photo: "Add a photo (optional)", then the photo with "Change photo" and "Remove", as on Details
   - danger link "Remove step"
4. Dashed "+ Add a step" (hidden at 100 steps).
5. Ink "Next: Variants".

A new recipe, or one with no steps, opens with one empty step, expanded. Left empty, Save drops it.

## Temperatures
- **Oven or pan temperatures** are typed in the instructions as people write them ("Bake at 180 °C", "350°F", "180C"). When the editor is left, and on Save, they become sage chips in both scales, "180 °C (350 °F)", and every reader sees both (spec 016 FR-006).
- **Thermometer readings** that tell you food is done use the "Temperature check" add-on. It shows on the recipe page and in cooking mode, and hides when the thermometer setting is off.
- A temperature typed in the text that is really a thermometer reading (sugar at 115 °C) can be set to "Thermometer" under the editor; it then rounds to 5 °F instead of 25 °F.

## Interactions
- Tapping a collapsed card opens it and closes the open one.
- Chips are never partly edited: deleting into one removes it, typing inside one lands after it.
- Removing an ingredient on Ingredients takes its chips out of the steps (as its dialog says).
- "Remove step" on a step with anything in it asks first: Dialog "Remove this step?" · "Its instructions and add-ons go with it." · "Remove" (danger) · "Keep it".
- Steps reorder by the handle (drag, Move up / Move down, arrow keys).

## Validation copy
| Case | Message |
| --- | --- |
| Chip whose ingredient was removed | warn chip "Missing ingredient", plus message "This ingredient was removed. Delete the chip or add it back." |
| Step with no instructions on Save | "Add instructions or remove this step" |
| Step text over 2,000 characters | "This step is too long. Split it into two steps." |
| Timer not a number | "Enter minutes, like 8 or 1 h 30" |
| Temperature check not a number (or outside −50 to 400 °C) | "Enter a temperature, like 71" |

Save opens the first step with a problem and brings it into view.

## Accessibility labels
| Element | Label |
| --- | --- |
| Collapsed card | "Step {n}, {name}. Tap to edit." (no name: "Step {n}. Tap to edit.") |
| Drag handle | "Drag to reorder", actions "Move up" / "Move down" |
| "+ Leeks" chip | "Insert Leeks" |
| "@" list | "Ingredient suggestions" |
| Add-on toggles | their name ("Timer"), pressed when on |
| Step photo | "Photo for step {n}" |
