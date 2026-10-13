# OC-SharedView — Shared recipe (public page)

Source `screens/OC-SharedView.dc.html` · Route `/r/[token]` (no account, no tab bar) · Spec 019

## Layout
1. White header bar: logo mark + "Our Cocon"; sage tag "View only".
2. Photo 220.
3. "Shared by {name}", title, description.
4. Servings card with stepper (works, not saved).
5. "Ingredients": rows "name" left, "{amount} · {weight}" right (bold); after 5 rows the link "Show {n} more".
6. "Steps": white cards "{n} · {name}" + body with bold amounts; timed steps have a honey button "Start {duration} timer".
7. Ink promo card: "Keep your family's recipes together" · "Save this {recipe} to your own Our Cocon and cook it with timers and servings that adapt." · honey button "Save to my Our Cocon".

## States
| State | Copy |
| --- | --- |
| Link stopped or recipe deleted | logo, then title "This recipe is no longer shared." and body "Ask the person who sent it for a new link." |
| Not found | same as above |

## Notes
Opens in metric; a pill toggle "Metric" · "Imperial" sits under Servings and only changes this viewer's page. The page is `noindex` with an Open Graph preview.
