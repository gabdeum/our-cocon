# OC-SettingsFamily — Family and your account

Source `screens/OC-SettingsFamily.dc.html` · Route `/settings/family` · Specs 003, 033, 029 · Sign-in pages: OC-Welcome.md

## Layout
1. Back link "Menu"; title "Family" (28/900); lead "Who's in the family, and your own account."
2. **Members**: rows — avatar in member color, name, sub-line "Has the app" or "Added by {name}", trailing "Owner" / "Can edit" / "No account". Then two dashed buttons side by side "+ Invite someone" · "+ Add without app", and hint "Add kids or anyone who won't use the app. They get a color in the calendar, and you choose who takes them to things."
3. **Your account**: "Your name" row with the name and a chevron; "Sign out" (olive link row); below the card, danger link "Delete my account" → Dialog "Delete your account?" · "Your recipes and events stay with the family. You'll be signed out on every device." · danger "Delete my account" · soft "Keep it".

## Add without app (sheet, not drawn)
Title "Add a family member"; lead "For kids or anyone who won't use the app."; "Name" input; "Color" swatches (free ones first); ink "Add". Error: "Give them a name."

## Behaviour
Every change saves instantly and applies to the whole family. Only the owner can change roles (tap a member → sheet "Make owner", "Remove from family") and sees "Delete family". Tapping a member without the app → sheet "Rename", "Change color", "Remove" (confirm "Move James's {n} upcoming events to Everyone?"). The owner's own row and, for other members, every row are not tappable. Every member can invite.

## Family and Account details (spec 003)
| Element | Result |
| --- | --- |
| "Invite someone" | Creates a 7-day, single-use link and opens the system share sheet with "Join {family} on Our Cocon: {link}" (busy: "Creating link…"). |
| Member row (owner only) | BottomSheet titled with the member's name: outline button "Make owner", danger link "Remove from family". |
| "Make owner" | Dialog (warning icon): "Make {name} the owner?" / "You'll stay in the family and can still edit. Only the owner manages members." · "Make owner" · "Cancel" |
| "Remove from family" | Dialog: "Remove {name} from the family?" / "They'll lose access to the family's recipes and groceries right away. You can invite them again later." · "Remove" · "Keep {name}" |
| "Your name" | BottomSheet "Your name": TextField "Your name" (hint "Shown to your family"), footer "Cancel" · "Save" (busy "Saving…"). |
| "Delete family" | Dialog: "Delete “{family}”?" / "This removes the family and everything in it for all {n} members. This can't be undone." · "Delete family" · "Keep it" → Set up your family. |
| "Delete my account" | → Sign in. |
| "Sign out" | → Sign in (`/welcome`). |

## States
| State | Copy and behaviour |
| --- | --- |
| Share sheet not available (some browsers) | The message is copied; StatusBanner "Invite link copied. Send it to them by message." |
| Invite couldn't be created | StatusBanner "Couldn't create an invite. Try again." |
| Too many invites | StatusBanner "Too many tries. Wait a minute, then try again." |
| A change failed | StatusBanner "Couldn't save. Try again." |
| Name missing | TextField warning "Add your name so your family knows who you are." |
| Name couldn't be saved | TextField warning "Couldn't save. Try again." inside the sheet (a StatusBanner would be hidden behind it). |
