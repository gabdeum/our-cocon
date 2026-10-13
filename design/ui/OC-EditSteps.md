# OC-EditSteps — Recipe form: Steps

Source `screens/OC-EditSteps.dc.html` · Route `…/edit?section=steps` · Spec 016

## Layout
1. Title "Steps".
2. Collapsed step cards: number badge, name, badges ("Tip", "{n} min").
3. The expanded step (2 px olive border, one at a time):
   - number + "Step name" input
   - "Instructions" editor with ingredient chips (sage)
   - hint "Type @ or tap below to insert an ingredient. Its amount fills in and scales by itself."
   - chips "+ {ingredient}" for ingredients not yet used in any step
   - "Preview" box showing the rendered text with bold amounts
   - "Add to this step": toggles "Timer", "Temperature check", "Chef's tip", "Photo" (olive with "✓" when on)
   - Timer: "Timer" (e.g. "8 min") and "Timer label" (defaults to the step name)
   - Temperature check: value + °C/°F toggle and the text "center reaches"; preview "→ shows (160 °F) automatically"
   - Chef's tip: textarea, placeholder "Something you wish you'd known the first time", max 200
4. Dashed "+ Add a step".
5. Ink "Next: Variants".

## Validation copy
| Case | Message |
| --- | --- |
| Chip whose ingredient was removed | warn chip "Missing ingredient", plus message "This ingredient was removed. Delete the chip or add it back." |
| Step with no instructions on Save | "Add instructions or remove this step" |
| Timer not a number | "Enter minutes, like 8 or 1 h 30" |
