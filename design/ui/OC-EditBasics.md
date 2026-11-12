# OC-EditBasics — Recipe form: Details

Source `screens/OC-EditBasics.dc.html` · Route `/recipes/new` · `/recipes/[id]/edit?section=details` · Specs 014, 027, 051

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
7. Ink switch card "Advanced mode", hint "Show every field: prep time, cuisine, source".
8. Advanced only: "Prep time" | "Cuisine"; "Source (optional)" with placeholder "A book and page, a website or “Grandma”" and hint "Book and page, a website, or a person. Assistants fill this in, or put their own name if there's nothing else." (spec 051 FR-015).
9. Editing only (never on New recipe): the "This recipe" section, at the end before "Next: Ingredients". See below.

## This recipe (spec 051 FR-013; editing only)
The recipe's own cooking settings (spec 027) and Delete, which used to be on the retired Recipe settings page.
1. Heading "This recipe" (20/900); lead "Only for this recipe. Family defaults are in Menu › Recipes."
2. White card, each row a Switch row:
   - "Keep screen on"
   - "I'll use a kitchen scale", hint "Shows “100 g” instead of “about 1 cup”" while it follows the default
   - "Thermometer checks"
   - "Units": segmented "Default" · "Metric" · "Imperial" (no hint: "Default" is the reset)
   Each switch's hint reads "Same as default" or, in warn, "Changed for this recipe · Reset". Reset puts the family default back.
3. "Delete recipe": white button, danger text, trash icon. It opens spec 018's Dialog (OC-Delete), then Recipes with "Recipe deleted · Undo".

- The settings save with the form's Save, like every other field (not at once); each setting changed is tracked as `recipe_setting_changed`.
- Offline: the switches and Units show, dimmed, and can't change; no Reset; "Delete recipe" is off.
- `&focus=this-recipe` opens Details scrolled to this section ("Units: {x}" on the recipe page and in cooking mode, and the old `/recipes/[id]/settings`, which redirects here).

## Cuisine picker
- The Cuisine field looks like an input with a chevron, showing the label ("French") or the placeholder "Pick one".
- Tapping it opens a BottomSheet titled "Cuisine" with choice pills (wrapping) for every cuisine in the list (spec 006 FR-003), alphabetical, then "Other". Tapping one selects it and closes the sheet. "Other" leaves the field empty.

## Photo (PhotoField, PhotoCrop)
- After picking a photo, a full-screen crop step (PhotoCrop): title "Fit your photo", hint "Drag to choose what shows in the header.", soft "Zoom out" | "Zoom in", then soft "Cancel" and olive "Use photo". The frame is the header's shape (13:8).
- While it uploads: the photo dimmed with "Uploading photo…" under it; "Change photo" waits until it's done.
- Photos access refused (iOS): warn callout "Our Cocon can't see your photos. Allow access in Settings."
- Screen-reader label of the photo: "Recipe photo".

## Validation copy
| Field | Message (warn style) |
| --- | --- |
| Name empty on Save | "Give your recipe a name" |
| Serves not 1–50 | "Enter a number from 1 to 50" |
| Time unreadable | "Try “1 h 10” or “70 min”" |
| Photo upload failed | warn callout "The photo didn't upload. Try again." with "Retry" |

## States
| State | What shows |
| --- | --- |
| Saving | Save (and "Save recipe") reads "Saving…" and waits; "Delete recipe" waits too |
| Save failed | warn callout at the top of the form "Couldn't save. Try again."; the form stays as typed |
| Offline | the StatusBanner "You're offline. You can read, but changes need a connection."; Save is disabled |
| Edit: recipe can't be loaded | "We couldn't open this recipe." · "It may have been deleted, or you're offline." · soft "Try again" · soft "Cancel" |
| Edit: loading | a skeleton block under the empty form bar |
| Cuisine sheet | scrim's screen-reader name "Close" |

## Leaving
Cancel with changes → Dialog "Discard your changes?" · body "Your edits to this recipe won't be saved." · danger "Discard" · soft "Keep editing".

## Changelog
- 2026-11-12 (051): Source placeholder and hint; the "This recipe" section (the recipe's own settings and "Delete recipe"), moved here from the retired Recipe settings page.
