# OC-ShareGroceries — Share the grocery list (sheet)

Not drawn · Route `/groceries/share` · Spec 072 · Built like OC-Share (a centred card from 600)

## Layout
1. Title "Share the grocery list".
2. Sage info callout with the eye icon: "Anyone with the link can see the list as it changes, without an account." With editing on, it adds "They can add, tick and remove items."
3. Overline "How long", then four pills in a row: "1 hour", "Today", "This week", "Until I stop". Today is selected by default.
4. Switch card: "Let people edit it" (on).
5. Link field (LinkField) with the ink button "Create link". Once created, it shows the link and "Copy link", and under it the sub-line "Ends today at 23:59" / "Ends Sunday at 23:59" (the clock as the device shows it) / "Until you stop sharing".
6. Three share tiles: honey "Message", soft "Email", soft "More" (ShareTile), off until a link exists.
7. Soft button "Copy as text" (block), always on.
8. Warn link "Stop sharing this link", only while a link exists.

## Dynamic copy
| Case | Copy |
| --- | --- |
| A link is already live when the sheet opens | it shows that link, its "How long" pill and its switch |
| No link yet | field reads "Not shared"; "Create link" makes it with the selected time and switch |
| Creating | field reads "Creating link…" |
| A pill or the switch changed on a live link | applies at once; failure puts it back with the warn toast "Couldn't change that. Try again." |
| After Copy link | button reads "Copied ✓" for 2 s; toast "Link copied" |
| After Copy as text | toast "List copied" |
| Copy as text with nothing to buy | toast "Nothing to buy on the list." |
| After Stop sharing | Dialog: "Stop sharing?" / "The link will stop working for everyone who has it." / "Stop sharing" (danger) and "Keep sharing"; then "Not shared" with "Create link" |
| Link couldn't be created | warn toast "Couldn't create the link. Check your connection and try again." with "Try again" |

## Interactions
Message, Email and More open the system share sheet with "Our grocery list — {link}".

Copy as text (FR-007):
```
Groceries

Produce
- Lemon: 3 pieces
- Onion: 2 pieces

Dairy & eggs
- Heavy cream: 1 pint carton (need 300 ml)
```
