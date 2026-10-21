# Tag

Small non-interactive labels: status tags (12 px) and meta chips (14 px) that describe a recipe or item.

## Specs

| Variant | Spec | Use |
| --- | --- | --- |
| `oc-tag--sage` | 12/800, padding 4 10, sage / olive-deep | "Variant", "View only" |
| `oc-tag--warn` | warn-soft / warn | "To buy", "Missing" |
| `oc-tag--honey` | honey / ink 900 | "+1" counts, "Tip" counts |
| `oc-tag--soft` | surface-soft / ink 800 | A collapsed step's add-ons in the recipe form: "12 min", "Temp check", "Tip", "Photo" (StepEditCard) |
| `oc-tag--white` | white / ink | "Latest recipe" over a photo |
| `oc-meta` | 14/700, padding 6 12, surface-soft | Recipe meta: "1 h 10", "Best Oct – Mar" |
| `oc-meta--white` / `--sage` / `--warn` | white (on soft cards) / sage (author "· via Claude") / warn-soft + warn 800 ("2 to buy") | |

## Rules

- One or two words. A tag is never tappable; if it should be, use a Pill.
- Tone has a meaning (warn = needs action, sage = info or variant). Never decorative.
