# OC-Units — Unit converter (sheet)

Source `screens/OC-Units.dc.html` · Route `/recipes/[id]/convert` · Spec 013

## Layout
1. Title "Unit converter"; close IconButton (soft, "Close").
2. Segmented control: "Weight" · "Volume" · "Oven temp".
3. "Convert": AmountField `xl`, a number input (26/900) and a unit picker (Weight: g, kg, oz, lb · Volume: ml, L, tsp, tbsp, cup, fl oz · Oven: °C, °F, gas mark). Switching tabs picks g, ml or °C.
4. A 2 × 2 grid of result tiles (number 26/900, unit 15/700); the first tile is honey, the rest white.
   - Volume: cups, tablespoons, teaspoons, fl oz (US), then ml; never the unit typed in. Cups to the nearest ¼, spoons whole from 10 (nearest ½ below), fl oz to 1 decimal.
   - Weight: g (kg from 1000 g; from g it shows kg and from kg it shows g), oz (1 decimal), lb (2 decimals), and "cups of {ingredient}" for the recipe ingredient below. Without one, 3 tiles.
   - Oven: the two other scales (°F in steps of 25, °C from °F in steps of 10, the nearest gas mark), then the fan oven: "{°C − 20}" "°C fan oven" and its "°F fan oven".
   - Units read singular up to 1: "¾ cup", "1 tablespoon".
5. Sage "For this recipe" card: one sentence linking the value to the first ingredient in this recipe measured the same way (a volume, or a weight) whose density is known. A volume: "300 ml heavy cream weighs about 300 g. Handy if you'd rather weigh it on your scale." A weight: "240 g heavy cream is about 1 cup. Handy if you'd rather use cups." Hidden when nothing matches, and on Oven temp.
6. Footnote: "Cups and spoons use US measures. You can change this in Settings."

## Behaviour
Results update as you type; with no number there are no tiles. The converter opens on Volume, empty (amounts on the recipe page can't be tapped yet, so there's no "last tapped amount"; 032-later).
