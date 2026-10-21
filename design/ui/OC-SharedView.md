# OC-SharedView — Shared recipe (public page)

Source `screens/OC-SharedView.dc.html` · Route `/r/[token]` (no account, no tab bar) · Spec 019

## Layout
1. White header bar: logo mark + "Our Cocon"; sage tag "View only".
2. Photo 220.
3. "Shared by {name}" ("Shared from Our Cocon" when that person has left the family), title, description.
4. When the link includes variants: "Version" with the version pills ("Classic" first) and the option switches, as on OC-Recipe (works, not saved).
5. Servings card with stepper (works, not saved), and the Metric · Imperial pill toggle under it, in the same card.
6. "Ingredients": rows "name" left, "{amount} · {weight}" right (bold; IngredientRow compact); after 5 rows the link "Show {n} more".
7. "Steps": StepCards as on OC-RecipeSteps (number badge and name, body with highlighted amounts, temperature check, tip); timed steps have the StepCard timer row ("Start timer" with its clock, then Pause, Resume, −1 / +1). A finished timer shows the chime banner without "Open timers".
8. Ink promo card: "Keep your family's recipes together" · "Save this {recipe} to your own Our Cocon and cook it with timers and servings that adapt." · honey button "Save to my Our Cocon".

## States
| State | Copy |
| --- | --- |
| Link stopped or recipe deleted | logo, then title "This recipe is no longer shared." and body "Ask the person who sent it for a new link." |
| Not found | same as above |
| Loading | header bar, then skeleton blocks in surface-soft |
| Couldn't load (offline, server down) | title "We couldn't open this recipe.", body "Check your connection and try again.", soft button "Try again" |
| Saving | the honey button reads "Saving…" |
| Save failed | warn Callout "Couldn't save this recipe. Try again." above the button |

## Notes
Opens in metric; a pill toggle "Metric" · "Imperial" sits under Servings and only changes this viewer's page (screen-reader name "Units"). The page is `noindex` with an Open Graph preview.

"Save to my Our Cocon": signed out, it goes to Sign in and comes back to this page, which then saves; without a family, to "Set up your family" first. The copy opens on the viewer's recipe page, its Source reading "Shared by {name}".
