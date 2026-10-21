# OC-Settings — Settings

Source `screens/OC-Settings.dc.html` · Route `/settings` · Specs 027, 021, 003, 025, 018, 029 · Sign-in pages: OC-Welcome.md

## Layout
1. Title "Settings".
2. **Cooking defaults**, lead "Used for every recipe. Each recipe can change them in its own settings.":
   - "Keep screen on while cooking" / "So it doesn't lock with floury hands"
   - "I have a kitchen scale" / "Off: shows cups and spoons instead of grams"
   - "I have a thermometer" / "Off: hides temperature checks in steps"
   - "Units": "Metric · g, ml, °C" | "Imperial · oz, °F"
3. **Groceries**:
   - "Where do you shop?" / "So the list shows packs you can actually buy": "US stores" | "European stores"; example "Recipe needs **300 ml cream**" → "Buy 1 pint" (EU: "Buy 2 × 20 cl")
   - "Round up to store sizes" / "Off: the list shows only what recipes need"
4. **Family**: member rows (avatar, name, "Owner" / "Can edit"), then dashed "+ Invite someone".
5. **More**: "AI assistants" "{n} connected ›" · "Recently deleted" "{n} recipe(s) ›".
6. **(Add, not drawn) Account**: "Your name" row (value: the name), "Sign out" (link), then a danger link: "Delete family" for the owner, "Delete my account" for everyone else (spec 003). Each opens a Dialog.
7. TabBar (Settings active).

## Behaviour
Every change saves instantly and applies to the whole family. Only the owner can change roles (tap a member → sheet "Make owner", "Remove from family"). The owner's own row and, for other members, every row are not tappable. Every member can invite.

## Family and Account details (spec 003)
| Element | Result |
| --- | --- |
| "Invite someone" | Creates a 7-day, single-use link and opens the system share sheet with "Join {family} on Our Cocon: {link}" (busy: "Creating link…"). |
| Member row (owner only) | BottomSheet titled with the member's name: outline button "Make owner", danger link "Remove from family". |
| "Make owner" | Dialog (warning icon): "Make {name} the owner?" / "You'll stay in the family and can still edit. Only the owner manages members." · "Make owner" · "Cancel" |
| "Remove from family" | Dialog: "Remove {name} from the family?" / "They'll lose access to the family's recipes and groceries right away. You can invite them again later." · "Remove" · "Keep {name}" |
| "Your name" | BottomSheet "Your name": TextField "Your name" (hint "Shown to your family"), footer "Cancel" · "Save" (busy "Saving…"). |
| "Delete family" | Dialog: "Delete “{family}”?" / "This removes the family and everything in it for all {n} members. This can't be undone." · "Delete family" · "Keep it" → Set up your family. |
| "Delete my account" | Dialog: "Delete your account?" / "You'll leave “{family}”. The family's recipes and groceries stay." · "Delete my account" · "Keep it" → Sign in. |
| "Sign out" | → Sign in (`/welcome`). |

## Recently deleted (spec 018, not drawn)
Route `/settings/deleted`, pushed from the "Recently deleted" row ("{n} recipe(s) ›", recipes deleted in the last 30 days). Built from ScreenHeader (back link "Settings", title "Recently deleted") and one ListGroup, newest first.

| Element | Copy and behaviour |
| --- | --- |
| Row | Title: the recipe name. Sub-line "Deleted by {name} · {n} days ago · {n} days left" ("today" on the day; "1 day ago"; "Last day" on the 30th; "Former member" once that person left). Trailing olive link "Restore" (screen reader: "Restore {name}"). |
| "Restore" | Puts it back as it was, for everyone. StatusBanner "“{name}” is back in your recipes." |
| Tap a row | BottomSheet titled with the recipe name: olive "Restore", danger link "Delete now". |
| "Delete now" | Dialog: "Delete “{name}” for good?" / "Its photos and variants go with it. This can't be undone." · "Delete now" · "Keep it" |
| Empty | "Nothing here." / "Recipes you delete stay here for 30 days." |
| Couldn't load | Callout "Couldn't load. Try again." + soft "Try again" |
| Restore failed / Delete now failed | StatusBanner "Couldn't restore. Try again." / "Couldn't delete. Try again." |
| Offline | Readable; "Restore" and the row's sheet are off (Patterns.md › Offline) |

## States
| State | Copy and behaviour |
| --- | --- |
| Share sheet not available (some browsers) | The message is copied; StatusBanner "Invite link copied. Send it to them by message." |
| Invite couldn't be created | StatusBanner "Couldn't create an invite. Try again." |
| Too many invites | StatusBanner "Too many tries. Wait a minute, then try again." |
| A change failed | StatusBanner "Couldn't save. Try again." |
| Name missing | TextField warning "Add your name so your family knows who you are." |
| Name couldn't be saved | TextField warning "Couldn't save. Try again." inside the sheet (a StatusBanner would be hidden behind it). |
