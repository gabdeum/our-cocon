# ToggleTile

An add-on switched on or off, in a two-column grid: "Add to this step" in the recipe form (OC-EditSteps, spec 016).

## Specs

| Part | Spec |
| --- | --- |
| Shape | 48 tall, radius 14, fills its grid cell; grid gap 8 |
| Off | surface-card, 2 px `line-strong`, ink 14/800 label |
| On | olive, white 14/800 label followed by "✓" ("Timer ✓") |

## States

Pressed: surface-soft (off) or olive-pressed (on). Focus: 3 px olive outline. `aria-pressed` carries the state; the screen-reader name is the label without "✓".

## Rules

- Each tile adds or removes a group of fields right under the grid, in the tiles' order.
- Turning a tile off keeps what was typed until Save, so turning it back on restores it.
