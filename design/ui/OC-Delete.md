# OC-Delete — Delete recipe

> 2026-11-21: "Delete recipe" deletes at once, with no Dialog: the Undo toast and Recently deleted are the way back. The dialog below is no longer shown.

Source `screens/OC-Delete.dc.html` · Spec 018

## Layout
Warn-soft disc with a danger trash icon · title "Delete “{recipe name}”?" · body "It will disappear for the whole family, along with its {n} variants. You can bring it back from Recently deleted for 30 days." · danger "Delete recipe" · soft "Keep it".

## Dynamic copy
- 0 variants: "It will disappear for the whole family. You can bring it back from Recently deleted for 30 days."
- 1 variant: "…along with its variant."

## After deleting
The app goes to Recipes; StatusBanner "Recipe deleted" with "Undo" (8 s).

## Not drawn (spec 018 build)
| State | Copy |
| --- | --- |
| Deleting failed | warn Callout above the link "Couldn't delete. Try again."; the form stays open |
| Undo failed | StatusBanner (warn) "Couldn't restore. Try again."; the recipe is still in Recently deleted |
| Offline | "Delete recipe" is off |
