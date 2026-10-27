# Feature Specification: Family members without the app, and member colors

**Feature Branch**: `033-members-without-app-colors` · **Status**: Ready · **Depends on**: 003
**Input**: Add family members who don't use the app (a newborn, a grandparent), and give every member one calendar color used everywhere.
**Design**: canvas `OC-SettingsFamily` (Members), `OC-SettingsFamily` (My color, moved from `OC-CalSettings` on 2026-10-27), `OC-Home` (avatar stack); components ListRow, Avatar, Button (dashed).

## User Scenarios & Testing

### User Story 1 — Add James, who has no account (P1)
Gabriel taps "+ Add without app", types "James", and James appears in the family with a color.
**Acceptance**:
1. **Given** the Family members list (today in Settings; Menu › Family once spec 029 is built), **When** Gabriel adds "James", **Then** the row reads "James · Added by Gabriel · No account" and James can be picked in "Who" when adding an event (spec 041).
2. **Given** James later gets the app, **When** an invite is accepted "as James", **Then** the same member keeps his events and color and his row reads "Has the app".

### User Story 2 — Every member has one color (P1)
**Given** a family of three, **Then** each member has a different color from the 8-color member palette, shown in avatars, chips, calendar events and filters, always with the member's initial.

### User Story 3 — Pick my color (P2)
**Given** My color on the Family page (moved from Menu › Calendar on 2026-10-27; built in this spec), **When** Eva taps a free swatch, **Then** her events change color for everyone; taken swatches show the initial of who has them and can't be picked.

### Edge cases
- More than 8 members: colors repeat from the start of the palette; initials keep them apart.
- Removing a member without the app: their past events stay, shown in `member-removed` (grey), future events move to Everyone after the owner confirms ("Move James's 4 upcoming events to Everyone?"). Until events exist (spec 035, 032-later L78) the confirm reads "Remove James?".
- Two members with the same initial: the second shows two letters ("Ev", "El").

## Requirements

- **FR-001**: A member is either an **account member** (signed in, spec 003) or a **managed member** (no account, `user_id` null, `managed_by` = the member who added them). Managed members can't sign in, receive no emails and have no AI connections.
- **FR-002**: The Family members list (today's Settings › Family; `/settings/family` after spec 029) lists every member: avatar, name, sub-line "Has the app" or "Added by {name}", trailing role ("Owner", "Can edit", "No account"). Two dashed buttons side by side: "+ Invite someone" (spec 003) and "+ Add without app" (opens a sheet: "Name", "Color", "Add"). Hint under them: "Add kids or anyone who won't use the app. They get a color in the calendar, and you choose who takes them to things."
- **FR-003**: Any member who can edit can add, rename or remove a managed member; only the owner removes account members (spec 003).
- **FR-004**: Member colors come from the tokens `member-honey`, `member-rose`, `member-sky`, `member-mint`, `member-lilac`, `member-peach`, `member-pistachio`, `member-clay` (design/system/tokens.json). New members get the first free one in that order. This replaces the three avatar tones of spec 003 FR-005.
- **FR-005**: Two pseudo-members exist in every family for events (spec 035): **Everyone** (token `member-everyone`, label "All") and **Others** (token `member-others`, person-outline icon, for events about people outside the family). They're not rows in Settings.
- **FR-006**: An invite can be accepted as an existing managed member, which links the account to that member. The link is made from the member's sheet ("Invite James"); the join page then offers "Join as James".

## Key Entities
- **Member** (extends 003): `id`, `kind` (account | managed, from `user_id`), `user_id?`, `managed_by?`, `color` (palette key). Initials are computed from names in join order (`memberInitials`).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `member_added_without_app` | — |
| `member_color_changed` | color |
| `managed_member_linked` | days_since_added |

## Warnings and errors
Copy is in the States tables of `design/ui/OC-SettingsFamily.md` and `design/ui/OC-CalSettings.md`. Name empty: "Give them a name."

## Needs your attention
- The canvas still shows My color on OC-CalSettings, and OC-Menu's Calendar row still reads "Your view, colors, times of day". The UI specs are updated (My color is on OC-SettingsFamily between Members and Your account; the row reads "Your view, times of day"); move them on the canvas and re-export `OC-CalSettings`, `OC-SettingsFamily` and `OC-Menu` when you can.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Settings became Menu (spec 029); the Family list moves to its own page there. References updated.
- 2026-10-27: Built. Members get an `id` (an account can take over a member without the app, keeping it), `color` (8-color palette, first free, repeating past 8; replaces the avatar tones) and `managed_by`. Any member adds, renames, recolors, invites or removes a member without the app; account members stay the owner's. Deviations, decided with Gabriel: "Join as James" is a link made from James's row ("Invite James"), so no link shows the list of kids' names; **My color moved to the Family page** (built here, not in 029). Initials are computed in `@cocon/schemas` (`memberInitials`), not stored, so renames can't leave them stale. Until events exist (035, 032-later L78), removing James asks "Remove James?" / "Their name and color come off the family list." The Settings tab's section is still headed "Family"; 029 gives the page "Members". New component ColorSwatch. Removing a member without the app also sends 003's `member_removed`, and "Invite James" sends 003's `invite_sent`.
