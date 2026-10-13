# OC-Units — Unit converter (sheet)

Source `screens/OC-Units.dc.html` · Route `/recipes/[id]/convert` · Spec 013

## Layout
1. Title "Unit converter"; close IconButton (soft, "Close").
2. Segmented control: "Weight" · "Volume" · "Oven temp".
3. "Convert": number input (26/900) and a unit dropdown (Weight: g, kg, oz, lb · Volume: ml, l, tsp, tbsp, cup, fl oz · Oven: °C, °F, gas mark).
4. A 2 × 2 grid of result tiles (number 26/900, unit 15/700); the first tile is honey, the rest white.
   - Volume: cups, tablespoons, teaspoons, fl oz (US).
   - Weight: g/kg, oz, lb, and "cups of {ingredient}" when a recipe ingredient is picked.
   - Oven: °C, °F, gas mark, and a fan-oven note "Fan oven: {°C − 20}".
5. Sage "For this recipe" card: one sentence linking the value to an ingredient in this recipe, e.g. "300 ml heavy cream weighs about 300 g. Handy if you'd rather weigh it on your scale." Hidden when nothing matches.
6. Footnote: "Cups and spoons use US measures. You can change this in Settings."

## Behaviour
Results update as you type. The converter opens on the tab matching the last tapped amount, otherwise Volume.
