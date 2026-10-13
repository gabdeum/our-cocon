# Callout

A tinted block that adds context: chef's tips, temperature checks, AI hints, notes and warnings.

## Specs

| Variant | Fill | Content |
| --- | --- | --- |
| `--tip` | surface-soft | Label "Chef's tip" 12/900 uppercase `warn`, then 15/600 text (16 in cooking mode) |
| `--temp` | sage | Thermometer icon 20, "Temperature check:" 900 + text 15/700 |
| `--ai` | sage | "AI" badge (white, radius 8, 12/900, padding 3 7) + 14/700 text |
| `--info` | sage | Optional icon + 15/700 text ("View only. Anyone with the link can read…") |
| `--warn` | warn-soft | warn text 15/700, warning icon |

All variants: radius 16 (18 in cooking mode), padding 12 14, icon gap 10, line-height 1.4.

## Rules

- One idea per callout, at most two sentences.
- Temperature values show both scales: "71 °C (160 °F)". Temperature callouts hide when the thermometer setting is off.
