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
| `--round` | 40 circle (touch target 44 through `hitSlop`), `shadow-button`, icon 22 (✕ 20) | surface-card / ink | The top bar's back and actions, on the page or over a photo (TopBar, spec 050); cooking mode's ✕ and options; Groceries' settings beside the title |
| `--outline` | 60 circle, 2 px `olive` border, icon 22 | surface-card / olive-deep | The recipe page's cart beside the ink main button, below 430 wide (spec 051 FR-014); from 430 it's an outline `lg` Button with the label |
| `--fab` | 60 circle, `shadow-lift` | olive / white, plus icon 28 | The calendar's floating "Add event" (OC-CalMonth) |

Icons are 20–22 px with stroke 2.2–2.6.

## Rules

- Always give it an `aria-label` ("Share recipe", "More servings").
- Over photos, keep 16 from the edges and 8 between buttons.
