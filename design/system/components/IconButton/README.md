# IconButton

Round or rounded-square buttons holding a single icon, used over photos, in steppers and for "more".

## Specs

| Variant | Size | Fill / icon | Use |
| --- | --- | --- | --- |
| default | 48 circle | surface-card / ink | Over photos: back, share, recipe settings |
| `--card` | 44 circle | surface-card / ink | Calendar header ‹ › on the page background |
| `--soft` | 44 circle | surface-soft / ink | Stepper minus, close in sheets |
| `--olive` | 44 circle | olive / white | Stepper plus |
| `--square` | 44, radius 14 | surface-soft / ink; honey when `aria-expanded="true"` | "More options" (…) |
| `--olive-square` | 54, radius 18 | olive / white | Add item next to an input |
| `--soft-square` | 54, radius 18 | surface-soft / ink | A second button beside the input, the same size as Add item: "Grocery settings" |

Icons are 20–22 px with stroke 2.2–2.6.

## Rules

- Always give it an `aria-label` ("Share recipe", "More servings").
- Over photos, keep 16 from the edges and 8 between buttons.
