# Feature Specification: Accounts and family

**Feature Branch**: `003-accounts-family` · **Status**: Ready · **Depends on**: 001, 002
**Input**: People sign in, create a family ("cocon"), and invite members who then share everything.
**Design**: canvas `OC-Settings` (Family section); components ListRow, Avatar, Button (dashed "Invite someone").

## User Scenarios & Testing

### User Story 1 — Start a family (P1)
Gabriel signs up, names his family, and lands on an empty Home.
**Acceptance**: **Given** a new account, **When** sign-up completes, **Then** a family exists with Gabriel as Owner and Home shows its empty states.

### User Story 2 — Invite a family member (P1)
Gabriel taps "Invite someone", sends a link by message, and Alex joins.
**Acceptance**:
1. **Given** an invite link, **When** Alex opens it and signs in, **Then** Alex joins as "Can edit" and sees all the family's recipes and groceries.
2. **Given** an invite older than 7 days or already used, **Then** it shows "This invite has expired. Ask for a new one."

### User Story 3 — Manage members (P2)
The owner sees members with their role and can remove someone or change their role.

### Edge cases
- The owner cannot remove themselves until they hand over ownership.
- A removed member immediately loses access, including their AI connections (spec 025).

## Requirements

- **FR-001**: Sign-in MUST support email magic link and Sign in with Google. No passwords. Sign in with Apple is added with the iPhone app (V2), where App Store rules require it alongside Google; keep the auth code provider-agnostic so it's a config addition.
- **FR-001b**: People stay signed in on each device until they sign out, are removed from the family, or don't open the app for 90 days. Sessions refresh silently in the background (short-lived access token, rotating refresh token, stored by the Supabase client on the device). Set the inactivity timeout in the Supabase Auth config; magic links expire after 1 hour and work once.
- **FR-002**: A family has one Owner and any number of members with role "Can edit". There is no read-only role in V1: every member can edit.
- **FR-003**: A user belongs to exactly one family in V1.
- **FR-004**: Invites are single-use links valid for 7 days, shared through the system share sheet.
- **FR-005**: Each member gets an avatar tone in join order (honey, sage, peach, repeat) and a display name.
- **FR-006**: Members can sign out; the owner can delete the family, which is confirmed with a Dialog and fully removes its data.

## Key Entities
- **Family**: name, created_at, owner_id.
- **Member**: user_id, family_id, role (owner | editor), display_name, avatar_tone, joined_at.
- **Invite**: family_id, token, created_by, expires_at, used_by.

## Success Criteria
- **SC-001**: A non-technical person joins from an invite in under 2 minutes without help.
- **SC-002**: Security tests prove a non-member gets no rows from any table.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `signed_up` | method (email, google) |
| `signed_in` | method |
| `family_created` | — |
| `invite_sent` | — |
| `invite_accepted` | days_since_sent |
| `invite_expired_seen` | — |
| `member_removed` | — |
| `family_deleted` | member_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Settings, OC-Welcome. New messages go there and in `strings/en.ts` first.

## Needs your attention
Your brief mentions an app-wide Admin with access to all families. V1 has no in-app super-admin: operating the service happens in the Supabase dashboard, so no app or AI token can bypass family security. Families have one Owner plus members who can edit; view access is share links (019).

From the build (2026-10-16):
- **Google sign-in credentials.** Create the OAuth client in Google Cloud Console and give it to `provision.sh` (docs/operations.md › First-time setup, step 5). Until then only the email link works.
- **Invite preview rate limit.** `invite_status` (callable signed out) has no request limit. Guessing is not a risk (256-bit tokens, every miss reads "expired"), but constitution VI asks for one. The front door (Caddy) needs a rate-limit plugin for it; decide whether to add it now or with spec 019's share links, which need the same.
- **Invite tokens in Auth logs.** A signed-out invitee's sign-in link carries `next=/join/<token>`, so the token shows in Supabase Auth's access logs (server only) until it is used or expires (7 days). Acceptable for V1, or keep the token on the device instead.
- **Deleting an account needs no fresh sign-in.** Someone holding a stolen, still-valid session (up to 1 hour) could delete a member's account. A Dialog guards the app. Asking for a new magic link first is possible later.
- **Supabase Cloud:** the 90-day inactivity timeout needs the Pro plan there (docs/move-to-supabase-cloud.md).

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-13: Stay signed in for 90 days of inactivity.
- 2026-10-13: Sign in with Apple moved to V2 (iPhone app); V1 is magic link + Google.
- 2026-10-16: Built. Magic link (PKCE) and Google sign-in, 90-day sessions, families, 7-day single-use invites through the share sheet, member management, delete family and delete my account. RLS and pgTAP tests prove a non-member and a signed-out visitor get no rows from any table, and functions added by later migrations start uncallable (each spec grants its own API). Deviations, agreed while planning:
  - The owner sees "Delete family" and other members see "Delete my account"; the UI spec had only "Delete my account".
  - An invitee alone in their own family can replace it after a Dialog; with other members they are told to leave first.
  - Every member can invite.
  - Settings shows only Family and Account. 021, 025, 027, 018 and 029 add the rest.
  - Home stays a placeholder until 028; the test proves sign-up lands on `/` with the family created.
  - The member sheet and "Your name" are in-screen sheets, not routes. "Check your email" is a state of `/welcome`, which keeps the email out of the URL.
  - "+ Invite someone" uses the plus icon with the label "Invite someone".
  - Sign-in, set up a family and join are described in the new `design/ui/OC-Welcome.md`.
  - Google's "G" was added as a design-system brand mark (Button `brand`).
  - Removed members lose their data access and sessions at once; spec 025 must also revoke their AI connections.

