# OC-Filters — Filter recipes (sheet)

Source `screens/OC-Filters.dc.html` · Route `/recipes/filters` · Spec 007

## Layout
1. BottomSheet header: title "Filters"; right link "Clear all".
2. "Best months": MonthPicker; hint "Shows recipes that are best this time of year."
3. "Total time": pills "Under 30 min", "30–60 min", "Over 1 hour" (single choice).
4. "Diet": pills "Vegetarian", "Has a vegetarian variant", "Dairy-free" (multi).
5. "Added by": person pills for each family member (multi).
6. Footer: ink full-width button "Show {n} recipes".

## Dynamic copy
| Case | Button |
| --- | --- |
| n = 1 | "Show 1 recipe" |
| n = 0 | disabled "No recipes match", plus hint above it "Try removing a filter" |

## Interactions
- Each tap updates the count live. "Clear all" resets every group. The button applies and closes. Swipe down closes without applying.
