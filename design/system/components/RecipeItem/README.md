# RecipeItem

A recipe in a list: thumbnail, name, one meta line and who added it.

## Specs

| Part | Spec |
| --- | --- |
| Container | surface-card, radius 22, padding 10, gap 14, whole item is a link |
| Thumbnail | 84 × 84, radius 16, photo cover (placeholder: peach / honey / sage) |
| Name | 17/900 ink, max 2 lines |
| Meta | 14/600 ink-muted: "1 h 10 · Serves 6 · French · 2 variants" |
| Author | 13/700 olive, 6 above: "Gabriel · via Claude", or just "Mia" |

## Rules

- Items stack with a 14 gap. The meta line shows only facts that help someone choose, in this order: time, servings, cuisine, variants. A fact with no value is left out with its separator.
- Add "via <assistant>" only when an AI created the recipe.
