# Feature Specification: Family members without the app, and member colors

**Feature Branch**: `033-members-without-app-colors` · **Status**: Ready · **Depends on**: 003
**Input**: Add family members who don't use the app (a newborn, a grandparent), and give every member one calendar color used everywhere.
**Design**: canvas `OC-SettingsFamily` (Members), `OC-CalSettings` (My color), `OC-Home` (avatar stack); components ListRow, Avatar, Button (dashed).

## User Scenarios & Testing

### User Story 1 — Add James, who has no account (P1)
Gabriel taps "+ Add without app", types "James", and James appears in the family with a color.
**Acceptance**:
1. **Given** the Family members list (today in Settings; Menu › Family once spec 029 is built), **When** Gabriel adds "James", **Then** the row reads "James · Added by Gabriel · No account" and James can be picked in "Who" when adding an event (spec 041).
2. **Given** James later gets the app, **When** an invite is accepted "as James", **Then** the same member keeps his events and color and his row reads "Has the app".

### User Story 2 — Every member has one color (P1)
**Given** a family of three, **Then** each member has a different color from the 8-color member palette, shown in avatars, chips, calendar events and filters, always with the member's initial.

### User Story 3 — Pick my color (P2)
**Given** Menu › Calendar › My color (screen built in spec 029; this spec provides the data and rules), **When** Eva taps a free swatch, **Then** her events change color for everyone; taken swatches show the initial of who has them and can't be picked.

### Edge cases
- More than 8 members: colors repeat from the start of the palette; initials keep them apart.
- Removing a member without the app: their past events stay, shown in `member-removed` (grey), future events move to Everyone after the owner confirms ("Move James's 4 upcoming events to Everyone?").
- Two members with the same initial: the second shows two letters ("Ev", "El").

## Requirements

- **FR-001**: A member is either an **account member** (signed in, spec 003) or a **managed member** (no account, `user_id` null, `managed_by` = the member who added them). Managed members can't sign in, receive no emails and have no AI connections.
- **FR-002**: The Family members list (today's Settings › Family; `/settings/family` after spec 029) lists every member: avatar, name, sub-line "Has the app" or "Added by {name}", trailing role ("Owner", "Can edit", "No account"). Two dashed buttons side by side: "+ Invite someone" (spec 003) and "+ Add without app" (opens a sheet: "Name", "Color", "Add"). Hint under them: "Add kids or anyone who won't use the app. They get a color in the calendar, and you choose who takes them to things."
- **FR-003**: Any member who can edit can add, rename or remove a managed member; only the owner removes account members (spec 003).
- **FR-004**: Member colors come from the tokens `member-honey`, `member-rose`, `member-sky`, `member-mint`, `member-lilac`, `member-peach`, `member-pistachio`, `member-clay` (design/system/tokens.json). New members get the first free one in that order. This replaces the three avatar tones of spec 003 FR-005.
- **FR-005**: Two pseudo-members exist in every family for events (spec 035): **Everyone** (token `member-everyone`, label "All") and **Others** (token `member-others`, person-outline icon, for events about people outside the family). They're not rows in Settings.
- **FR-006**: An invite can be accepted as an existing managed member ("Join as James?"), which links the account to that member.

## Key Entities
- **Member** (extends 003): `kind` (account | managed), `user_id?`, `managed_by?`, `color` (palette key), `initials`.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `member_added_without_app` | — |
| `member_color_changed` | color |
| `managed_member_linked` | days_since_added |

## Warnings and errors
Copy is in the States tables of `design/ui/OC-SettingsFamily.md` and `design/ui/OC-CalSettings.md`. Name empty: "Give them a name."

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Settings became Menu (spec 029); the Family list moves to its own page there. References updated.
