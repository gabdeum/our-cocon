# Card

Flat rounded containers: the default white card, a soft card, and the photo hero card ("Latest recipe").

## Specs

| Variant | Spec |
| --- | --- |
| `oc-card` | surface-card, radius 22, padding 16, gap 12 between blocks, no shadow |
| `--soft` | surface-soft (recipe link cards, AI activity, info cards) |
| `--sage` | sage, radius 20, padding 14 16, gap 6: calm results ("Recipe × 1.25 → about 7½ servings", the converter's "For this recipe") |
| `--warn` | warn-soft, radius 20, padding 14 16, gap 10, text in `warn`: something that stops a feature, with what to do (OC-SettingsNotif's "Notifications are off for Our Cocon" and "Open iPhone Settings", spec 046) |
| `--ink` | ink, radius 24, padding 18, gap 10; title 18/900 on-olive (white), body 15/600 on-ink, a honey button: a promo block (OC-SharedView's "Keep your family's recipes together") |
| `--selected` | 2 px olive border (the step or variant being edited) |
| `--attention` | 2 px warn-border (a row with a problem) |
| Hero (`oc-hero`) | radius 28, surface-soft, overflow hidden; photo 170–190 tall with a white Tag "Latest recipe" at 14,14; body padding 14 18 16: title 22/900, meta chips row (white `oc-meta`, gap 8, 10 above) |
| Hero with actions | a cook in progress on Home (spec 028): white Tag "Cooking now: step 3/10", the title, no chips, then a row of small buttons 12 under the title (padding 0 14 16, gap 6): `Button --danger-outline --compact` "Cancel" and `Button --white --compact` "Done" (1 each), `Button --ink --compact` "Resume" with the play icon (1.3), so the three fit on a 390 px phone. The photo and title are the link (it resumes); the buttons sit under it, never inside |
| Hero carousel | several hero cards side by side, one per width, 12 apart: swipe for the next (paging; each page is a card and its gap, the slider reaching 12 into the screen's side margin). 6 under them, centred dots 8 × 8 `line-strong`, the current one 20 × 8 olive, in a 20 tall row (each dot's target reaches 44) that shows its card ("Show {recipe}", `aria-current` on the one showing). One card: no dots. The whole is a region named "{n} recipes cooking" |
| Thumb | 40 × 40, radius 12, the recipe's photo (cover) or a peach placeholder: the grocery list's recipe cards (OC-Groceries). `lg` 48 × 48, radius 14: the recipe menu's header (OC-GroceryRecipeMenu, spec 052) |
| Photo placeholder (`oc-photo`) | peach fill, peach-ink 14/700 label; real photos are `object-fit: cover`. No photo on a recipe page: the recipe's first letter, 32/900 peach-ink (`PhotoPlaceholder initial`) |

## Rules

- Cards never have shadows. Separation comes from colour against `surface-page`.
- A card that links somewhere is entirely tappable; don't put a separate "Open" button inside unless it holds other actions.
