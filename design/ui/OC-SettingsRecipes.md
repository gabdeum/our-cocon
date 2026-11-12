# OC-SettingsRecipes — Recipes settings (your units, family cooking defaults)

Source `screens/OC-SettingsRecipes.dc.html` · Route `/settings/recipes` · Specs 027, 029, 051

## Layout
1. TopBar (spec 050): back "Back to Menu", title "Recipes" (`titleMode="always"`); then the lead "Your units, and the cooking defaults for the whole family. Each recipe can change those in Edit › This recipe."
2. **For you** card (spec 051): "Units": "Metric · g, ml, °C" | "Imperial · oz, °F", with the hint "Only for you. A recipe’s “…” can switch them for one visit." Shows the family's old units until the member picks.
3. **Cooking defaults** card:
   - "Keep screen on while cooking" / "So it doesn't lock with floury hands"
   - "I have a kitchen scale" / "Off: shows cups and spoons instead of grams"
   - "I have a thermometer" / "Off: hides temperature checks in steps"

## Behaviour
Saves instantly: units for the member only (`member_recipe_settings`, sent as `my_units_changed`), the cooking defaults for the whole family. The member's units also set the grocery list's amounts. Each recipe changes them in the recipe form's "This recipe" section (Edit › This recipe, OC-EditBasics), not on a settings page of its own; its lead reads "Only for this recipe. Family defaults are in Menu › Recipes."

## States
| State | Copy and behaviour |
| --- | --- |
| A change failed | warn toast "Couldn't save. Try again." |

## Changelog
- 2026-11-12 (051): per-recipe overrides moved from Recipe settings (retired) to the recipe form's "This recipe".
- 2026-11-12 (051, after review with Gabriel): Units are each member's own, in a "For you" card; the family default for units and a recipe's own units are gone.
