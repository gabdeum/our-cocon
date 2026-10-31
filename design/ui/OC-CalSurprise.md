# OC-CalBusy and OC-CalSurprise — private and surprise events

Sources `screens/OC-CalBusy.dc.html` (what others see of a private event) and `screens/OC-CalSurprise.dc.html` (what Eva sees of her surprise) · Spec 043

## "Who can see it?" (in OC-CalAdd)
| Choice | Hint |
| --- | --- |
| Family | "Everyone in the family sees all the details." |
| Private | "Others see “Busy” at this time, and nothing else." |
| Surprise | "Hide it from someone: they see only what you choose below." |

Surprise panel (white card): "What Eva sees" (input, e.g. "Dinner out"), "Note for Eva" (textarea, e.g. "Meet at Café Lalo at 19:30. Dress nice!"), summary "Eva sees only this title, the time, the place and this note. Everyone else sees everything." Error: "Add what Eva will see." The surprise is kept from the people in Who: the members with the app, except the creator ("Everyone" means all of them). There is no "Keep it secret from" picker (decided 2026-10-29).

## OC-CalBusy (sheet)
Avatar 48 + "Eva is busy" (24/900) + "Thursday, Oct 22 · Afternoon"; white row with lock icon "Eva keeps the details of this one private."; ink "OK". Chips and rows elsewhere read "Busy".

## OC-CalSurprise (event detail as the hidden person sees it)
Back "Calendar"; title "Dinner out"; member chip "E Eva"; rows: "Saturday, Oct 31" / "Evening · about 18:00–22:00", "Café Lalo" + "Open in Maps"; sage card overline "Note from Gabriel" + note 18/800; "Added by Gabriel · today". No Edit, Duplicate, Share or Delete.
Everyone else sees the real event with a sage "Surprise" tag and "hidden from Eva" in the sub-line.

## Copy not in the drawings (spec 043 build)
| Where | Copy |
| --- | --- |
| Surprise, nobody picked yet | labels "What they see" / "Note for them", summary "They see only this title, the time, the place and this note. Everyone else sees everything." |
| Surprise, several people picked | "What Eva and Alex see", "Note for Eva and Alex", "Eva and Alex see only…" |
| Save with nobody with the app in Who (other than the creator) | "Pick who the surprise is for in Who: someone with the app, other than you." (warn, `role="alert"`, at the top of the surprise card) |
| Save with no cover title, nobody picked | "Add what they will see." |
| "Who can see it?" when editing someone else's event, or "This event only" | not shown (only the creator changes it, FR-005) |
| Editing a surprise: adding to Who someone it can't be kept from ("This event only", or not the creator) | "Léa would see this surprise. Only its creator can add someone to it, on the whole event." (warn, under Who; Save blocked) |
| OC-CalBusy, the creator has left the family | "Someone is busy" · "They keep the details of this one private." (no avatar) |
| "hidden from Eva" | added to the time line of agenda and day rows: "Evening · Café Lalo · hidden from Eva"; the event page shows the sage "Surprise" tag after the type tag |
