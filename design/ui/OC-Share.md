# OC-Share — Share this recipe (sheet)

Source `screens/OC-Share.dc.html` · Route `/recipes/[id]/share` · Spec 019

## Layout
1. Title "Share this recipe".
2. Recipe card: thumb, name, "From the {family name} family" (a leading "The" in the family name is dropped: "The Smiths" → "From the Smiths family").
3. Sage info callout with eye icon: "View only. Anyone with the link can read and cook it, but can't change it or see your other recipes."
4. Link field (read-only, truncated) + ink button "Copy link" (LinkField).
5. Three share tiles: honey "Message", soft "Email", soft "More" (ShareTile).
6. Switch card: "Include variants", "Include chef's tips".
7. Warn link "Stop sharing this link".

## Dynamic copy
| Case | Copy |
| --- | --- |
| After Copy link | button reads "Copied ✓" for 2 s; StatusBanner "Link copied" |
| Not yet shared | the link is created when the sheet opens; field shows "Creating link…" until then |
| After Stop sharing | Dialog: title "Stop sharing?", body "The link will stop working for everyone who has it.", buttons "Stop sharing" (danger) and "Keep sharing"; then the sheet shows "Not shared" and the button "Create a new link". While "Not shared", the three share tiles and the two switches are disabled and "Stop sharing this link" is hidden |
| Link couldn't be created | warn Callout "Couldn't create the link. Check your connection and try again." and a soft button "Try again", in place of the link field |
| A switch or Stop sharing failed | the switch goes back; StatusBanner "Couldn't change that. Try again." |

## Interactions
Message, Email and More open the system share sheet with the text "{recipe name} — {link}".
