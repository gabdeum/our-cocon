# OC-EditBasics — Recipe form: Details

Source `screens/OC-EditBasics.dc.html` · Route `/recipes/new` · `/recipes/[id]/edit?section=details` · Spec 014

## Shared form chrome (all four sections)
- Form bar: "Cancel" (muted link) · title "New recipe" or "Edit recipe" · olive sm "Save".
- Progress with links "Details" · "Ingredients" · "Steps" · "Variants" (done = olive-muted, current = olive).
- Last block: ink "Next: Ingredients" / "Next: Steps" / "Next: Variants"; on Variants it reads "Save recipe".

## Layout
1. Sage AI callout (new recipes only): "AI" badge + "Faster: tell your AI assistant “Save Grandma's quiche to Our Cocon” and it fills this in for you."
2. Dashed photo button 150 tall, camera icon, "Add a photo (optional)"; once added, the photo shows with "Change photo" and "Remove".
3. "Recipe name" input.
4. "Short description" textarea; hint "One sentence that makes people hungry. {count} / 140".
5. Row: "Serves" | "Total time" inputs.
6. "Best months to make it": MonthPicker; hint "Leave empty if it's good all year."
7. Ink switch card "Advanced mode", hint "Show every field: prep time, cuisine, tags, source".
8. Advanced only: "Prep time" | "Cuisine"; "Diet" pills ("Vegetarian", "Dairy-free"); "Source (optional)" with placeholder "A book, a website or “Grandma”".

## Validation copy
| Field | Message (warn style) |
| --- | --- |
| Name empty on Save | "Give your recipe a name" |
| Serves not 1–50 | "Enter a number from 1 to 50" |
| Time unreadable | "Try “1 h 10” or “70 min”" |
| Photo upload failed | warn callout "The photo didn't upload. Try again." with "Retry" |

## Leaving
Cancel with changes → Dialog "Discard your changes?" · body "Your edits to this recipe won't be saved." · danger "Discard" · soft "Keep editing".
