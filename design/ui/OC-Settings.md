# OC-Settings — Settings

Source `screens/OC-Settings.dc.html` · Route `/settings` · Specs 027, 021, 003, 025, 018, 029

## Layout
1. Title "Settings".
2. **Cooking defaults**, lead "Used for every recipe. Each recipe can change them in its own settings.":
   - "Keep screen on while cooking" / "So it doesn't lock with floury hands"
   - "I have a kitchen scale" / "Off: shows cups and spoons instead of grams"
   - "I have a thermometer" / "Off: hides temperature checks in steps"
   - "Units": "Metric · g, ml, °C" | "Imperial · oz, °F"
3. **Groceries**:
   - "Where do you shop?" / "So the list shows packs you can actually buy": "US stores" | "European stores"; example "Recipe needs **300 ml cream**" → "Buy 1 pint" (EU: "Buy 2 × 20 cl")
   - "Round up to store sizes" / "Off: the list shows only what recipes need"
4. **Family**: member rows (avatar, name, "Owner" / "Can edit"), then dashed "+ Invite someone".
5. **More**: "AI assistants" "{n} connected ›" · "Recently deleted" "{n} recipe(s) ›".
6. **(Add, not drawn) Account**: "Your name" row, "Sign out" (link), "Delete my account" (danger link → Dialog).
7. TabBar (Settings active).

## Behaviour
Every change saves instantly and applies to the whole family. Only the owner can change roles (tap a member → sheet "Make owner", "Remove from family").
