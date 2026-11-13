# Feature Specification: Links open the iPhone app (any page, the web app without it)

**Feature Branch**: `054-deep-links` · **Status**: Ready · **Depends on**: 003, 019, 042, 045
**Input**: Gabriel (2026-11-12): a link to any part of the app (a recipe, an event, Settings, all recipes…) opens the iPhone app when it's installed and the web app otherwise. Also does 032-later L46 (share and invite links open in the app).
**Design**: no new screen. `OC-Welcome` (Join on the iPhone) changes one note.
**Not in scope**: a "Copy link" action on screens (decided 2026-11-12: links come from the address bar, assistants and notifications for now); Android App Links; the Smart App Banner (needs the App Store id, L143).

## How it works
Links are the web app's own addresses (`https://app.ourcocon.com/recipes/<id>`), never `ourcocon://`: a custom scheme has no fallback (Safari says the address is invalid without the app) and many apps don't make it tappable. iOS opens such an address in the app when the domain's link file names the path (Universal Links). Every screen already has the same path on the web and the iPhone (Expo Router), and MCP tools already return these links (`recipeLink`, `eventLink`).

## User Scenarios & Testing

### User Story 1 — A link opens the app (P1)
**Acceptance**:
1. **Given** the app is installed and signed in, **When** I tap `https://app.ourcocon.com/recipes/<id>` in Messages, **Then** the recipe opens in the app.
2. **Given** the app isn't installed, **When** I tap the same link, **Then** the recipe opens in Safari (the web app).
3. **Given** an assistant replies with an event's link, **When** I tap it on the iPhone, **Then** that date of the event opens in the app.
4. **Given** `ourcocon://settings/notifications` (or `ourcocon:///settings/notifications`), **When** opened, **Then** Settings › Notifications opens.

### User Story 2 — Signed out, the link waits (P1)
**Given** I'm signed out, **When** I open `/calendar/<id>?date=2026-11-20`, **Then** I sign in on Welcome and land on that event's date, not Home. **Given** I sign out from Settings, **Then** signing in again lands on Home.

### User Story 3 — Invites and shared things in the app (P2, L46)
**Given** the app is installed, **When** I tap an invite (`/join/<token>`), a shared recipe (`/r/<token>`) or a shared event (`/e/<token>`), **Then** it opens in the app; on Join, signed out, I can continue with Apple, Google or email and come back to the invite.

### Edge cases
- A recipe or event that's deleted or belongs to another family: the page's existing "We couldn't open this recipe/event." state (OC-Recipe, OC-CalEvent).
- An assistant's connection link (`/oauth/consent`) and Google's web sign-in (`/auth/callback`) stay in the browser that started them. Signing in by email from the consent page can still finish in the app (as since spec 045): the app approves there and sends the member back to the assistant's checked address.
- Typed into Safari, or tapped on a page of `app.ourcocon.com`: iOS stays in Safari (Universal Links' own rule).

## Requirements
- **FR-001 Link file**: `apps/app/public/.well-known/apple-app-site-association` names every path for app `59TR87TBX2.com.ourcocon.app`, excluding `/oauth/*`, `/auth/callback`, `/dev/*`, `/email/*`, `/_expo/*`, `/assets/*` and files (`/*.*`). Exclusions come first (iOS uses the first match). Shipped with the web app; the build already has `applinks:app.ourcocon.com`, so no new build. Staging isn't linked: its links stay in the browser.
- **FR-002 Keep the page through sign-in**: a member who opens a page while signed out goes to `/welcome?next=<the page, with its query>` (`gateRedirect`, `openedPath` in `lib/session.tsx`; `safeNext` keeps only the app's own paths). After signing out, Welcome has no `next`.
- **FR-003 Join in the app**: Join's sign-in shows the iPhone's Apple and Google sheets, as Welcome does (spec 045), and comes back to `/join/<token>`. Approve access stays email-only in the app (it never opens there).
- **FR-004 Incoming links**: Expo Router turns `https://…/<path>`, `ourcocon://<path>` and `ourcocon:///<path>` into the same route; no `+native-intent` is needed.

## Success Criteria
- **SC-001**: On a TestFlight build, each link in User Story 1 opens the right screen within 2 seconds of the tap.
- **SC-002**: A test proves every app page opens in the app, and `/oauth/consent`, `/auth/callback` and files don't.

## Tracking (PostHog)
No new events.

## Warnings and errors
None new.

## Needs your attention
- After the prod web deploy, Apple's copy of the link file can take up to a day to refresh (`https://app-site-association.cdn-apple.com/a/v1/app.ourcocon.com`); links keep opening Safari until then.

## Changelog
- 2026-11-12: Written and built. The link file names every page except an assistant's connection, Google's web sign-in and files; a page opened signed out comes back after sign-in; Join offers Apple and Google in the app (L46). Detail pages already had their "couldn't open" state and Expo Router already reads `ourcocon://` both ways, so neither needed code. Smart App Banner deferred (L143: needs the App Store id).
