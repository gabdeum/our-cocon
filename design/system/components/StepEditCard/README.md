# StepEditCard

One step in the recipe form: collapsed to its number, name and badges, or expanded with its fields (OC-EditSteps, spec 016).

## Specs

| Part | Spec |
| --- | --- |
| Collapsed | surface-card, radius 18, padding 12 14 (8 on the handle side), row gap 10; the whole card opens the step |
| Number badge | 30 round, 14/900; honey with ink when collapsed, olive with white when expanded |
| Title | the step's name, else its text's first line, 16/800, one line |
| Badges | Tag `soft`, one per add-on, after the title in the toggles' order ("12 min", "Temp check", "Tip", "Photo"); gap 6, at most 60% of the row, wrapping right-aligned |
| Note | `StepNote`: sage, radius 12, padding 8 10, 14/700: the temperature check in the open step ("Temperature check: center reaches 71 °C (160 °F)") |
| Expanded | like Card `--selected`: surface-card, radius 22, padding 14, gap 12, 2 px olive border; header row = handle, olive badge, "Step name" input (TextField `--sm`) |
| Preview | `StepPreview`: surface-page, radius 14, padding 10 12; overline "Preview", then StepText `compact` (14/600, amounts 900) |
| Field pair | `FieldPair`: two fields 1 : 1.6, gap 8 (Timer and Timer label) |
| Handle | from ReorderList, first in the row, as on IngredientEditCard |

## States

Collapsed pressed: 90% opacity. Focus: 3 px olive outline. Attention: 2 px `warn-border` (a step Save found a problem in), and the warned field shows its message. Only one card is expanded at a time; the screen decides which.

## Rules

- The collapsed card is a button whose screen-reader name says what it does: "Step 3, Cook the filling. Tap to edit."
- Badges are one or two words: an add-on's name, or a timer's length.
