# Card

Flat rounded containers: the default white card, a soft card, and the photo hero card ("Latest recipe").

## Specs

| Variant | Spec |
| --- | --- |
| `oc-card` | surface-card, radius 22, padding 16, gap 12 between blocks, no shadow |
| `--soft` | surface-soft (recipe link cards, AI activity, info cards) |
| `--sage` | sage, radius 20, padding 14 16, gap 6: calm results ("Recipe × 1.25 → about 7½ servings", the converter's "For this recipe") |
| `--ink` | ink, radius 24, padding 18, gap 10; title 18/900 on-olive (white), body 15/600 on-ink, a honey button: a promo block (OC-SharedView's "Keep your family's recipes together") |
| `--selected` | 2 px olive border (the step or variant being edited) |
| `--attention` | 2 px warn-border (a row with a problem) |
| Hero (`oc-hero`) | radius 28, surface-soft, overflow hidden; photo 170–190 tall with a white Tag "Latest recipe" at 14,14; body padding 14 18 16: title 22/900, meta chips row (white `oc-meta`, gap 8, 10 above) |
| Thumb | 40 × 40, radius 12, the recipe's photo (cover) or a peach placeholder: the grocery list's recipe cards (OC-Groceries) |
| Photo placeholder (`oc-photo`) | peach fill, peach-ink 14/700 label; real photos are `object-fit: cover`. No photo on a recipe page: the recipe's first letter, 32/900 peach-ink (`PhotoPlaceholder initial`) |

## Rules

- Cards never have shadows. Separation comes from colour against `surface-page`.
- A card that links somewhere is entirely tappable; don't put a separate "Open" button inside unless it holds other actions.
