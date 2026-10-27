# OC-SettingsRecipes — Recipes settings (family cooking defaults)

Source `screens/OC-SettingsRecipes.dc.html` · Route `/settings/recipes` · Specs 027, 029

## Layout
1. Back link "Menu" ("Settings" until spec 029 builds the Menu); title "Recipes"; lead "Used for every recipe, for the whole family. Each recipe can change them in its own settings."
2. **Cooking defaults** card:
   - "Keep screen on while cooking" / "So it doesn't lock with floury hands"
   - "I have a kitchen scale" / "Off: shows cups and spoons instead of grams"
   - "I have a thermometer" / "Off: hides temperature checks in steps"
   - "Units": "Metric · g, ml, °C" | "Imperial · oz, °F"

## Behaviour
Saves instantly for the whole family. Recipe settings (OC-RecipeSettings) override per recipe; its lead reads "These only change this recipe. Your family defaults are in Menu › Recipes."

## States
| State | Copy and behaviour |
| --- | --- |
| A change failed | StatusBanner "Couldn't save. Try again." |
