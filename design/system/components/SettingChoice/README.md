# SettingChoice

A setting whose options sit under its label, with an optional line showing what the choice does: "Where do you shop?", "Units".

## Specs

| Part | Spec |
| --- | --- |
| Row | padding 14 0, gap 10, 1.5 px `line` divider (none on the last row); shares a `ListGroup` with `SettingRow`s |
| Label · hint | 16/800 ink · 13/600 ink-muted, 2 px apart |
| Control | a light `SegmentedControl` at full width |
| Example | `surface-page`, radius 14 (`radius-md`), padding 10 × 12, gap 10: lead 14/700 ink with its bold part 14/900, result 14/900 `olive-deep` on one line ("Recipe needs **300 ml cream**" → "Buy 2 × 20 cl") |
| Disabled (offline) | label ink-muted; the control is disabled (`opacity-dimmed`) |

## Rules

- Use it when a setting has two to four named options; an on/off setting is a `SettingRow`.
- The example updates with the choice and shows a real case, not a description.
- The control carries the screen-reader name (the setting's label).
- Why it exists: the Grocery settings sheet (OC-Groceries, spec 021) stacks the store choice and its example; Cooking defaults › Units (spec 027) is the same shape.
