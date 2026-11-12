# OC-SettingsRecipes — Recipes settings (family cooking defaults)

Source `screens/OC-SettingsRecipes.dc.html` · Route `/settings/recipes` · Specs 027, 029

## Layout
1. TopBar (spec 050): back "Back to Menu", title "Recipes" (`titleMode="always"`); then the lead "Used for every recipe, for the whole family. Each recipe can change them in Edit › This recipe."
2. **Cooking defaults** card:
   - "Keep screen on while cooking" / "So it doesn't lock with floury hands"
   - "I have a kitchen scale" / "Off: shows cups and spoons instead of grams"
   - "I have a thermometer" / "Off: hides temperature checks in steps"
   - "Units": "Metric · g, ml, °C" | "Imperial · oz, °F"

## Behaviour
Saves instantly for the whole family. Each recipe changes them in the recipe form's "This recipe" section (Edit › This recipe, OC-EditBasics), not on a settings page of its own; its lead reads "Only for this recipe. Family defaults are in Menu › Recipes."

## States
| State | Copy and behaviour |
| --- | --- |
| A change failed | StatusBanner "Couldn't save. Try again." |

## Changelog
- 2026-11-12 (051): per-recipe overrides moved from Recipe settings (retired) to the recipe form's "This recipe".
