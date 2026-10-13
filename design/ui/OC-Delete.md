# OC-Delete — Delete recipe (dialog)

Source `screens/OC-Delete.dc.html` · Spec 018

## Layout
Warn-soft disc with a danger trash icon · title "Delete “{recipe name}”?" · body "It will disappear for the whole family, along with its {n} variants. You can bring it back from Recently deleted for 30 days." · danger "Delete recipe" · soft "Keep it".

## Dynamic copy
- 0 variants: "It will disappear for the whole family. You can bring it back from Recently deleted for 30 days."
- 1 variant: "…along with its variant."

## After deleting
The app goes to Recipes; StatusBanner "Recipe deleted" with "Undo" (8 s). Focus starts on "Keep it".
