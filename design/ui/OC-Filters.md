# OC-Filters — Filter recipes (sheet)

Source `screens/OC-Filters.dc.html` · Route `/recipes/filters` · Spec 007

## Layout
1. BottomSheet header: title "Filters"; right link "Clear all".
2. "Best months": MonthPicker; hint "Shows recipes that are best this time of year."
3. "Total time": pills "Under 30 min", "30–60 min", "Over 1 hour" (single choice). Recipes with no total time match every option.
4. "Cuisine": pills for the cuisines the family's recipes use, most recipes first (multi). The first 10 show, then a pill "Show {n} more" that expands the rest; "Other" comes last when some recipes have no cuisine. Hidden when no recipe has a cuisine.
5. "Added by": person pills for each family member (multi).
6. Footer: ink full-width button "Show {n} recipes".

## Dynamic copy
| Case | Button |
| --- | --- |
| n = 1 | "Show 1 recipe" |
| n = 0 | disabled "No recipes match", plus hint above it "Try removing a filter" |

## Interactions
- Each tap updates the count live. "Clear all" resets every group. The button applies and closes. Swipe down closes without applying.
