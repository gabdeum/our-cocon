# Feature Specification: iPhone sign-in

**Feature Branch**: `045-iphone-sign-in` · **Status**: Ready · **Depends on**: 003, the iOS release setup (CLAUDE.md › Releasing (iOS))
**Input**: People sign in to the iPhone app the same ways as on the web (email link, Google), plus Sign in with Apple, which the App Store requires next to Google (decision 8, spec 003 FR-001).
**Design**: `design/ui/OC-Welcome.md` (Sign in, Check your email, link states); components Button (outline, `brand` marks), Callout. Add to OC-Welcome.md; don't replace it.

## User Scenarios & Testing

### User Story 1 — Sign in from the email on the iPhone (P1)
Gabriel types his email in the iPhone app, opens the email on the same iPhone and taps "Sign in".
**Acceptance**:
1. **Given** the iPhone app is installed, **When** Gabriel taps the link in Mail, **Then** the app opens (not Safari) and he is signed in, landing where he was going (`next`).
2. **Given** someone asked for the link on the web, **When** they tap it on a device without the app, **Then** the web app signs them in, in whichever browser opens the link.
3. **Given** a link older than 1 hour or already used, **Then** "This sign-in link has expired or was already used. Ask for a new one." (existing state).

### User Story 2 — Continue with Google on the iPhone (P1)
**Given** the Sign in screen in the iPhone app, **When** Alex taps "Continue with Google" and picks an account in Google's sheet, **Then** the app is signed in without leaving it, and a new person goes on to "Your name", prefilled with Google's first name, as on the web.

### User Story 3 — Continue with Apple on the iPhone (P1)
**Given** the Sign in screen in the iPhone app, **When** Eva taps "Continue with Apple" and confirms with Face ID, **Then** she is signed in. A new person goes on to "Your name", prefilled with the first name Apple gives (only on the first sign-in) or empty.

### Edge cases
- An app other than Our Cocon must never receive a sign-in code or token: no custom-scheme (`ourcocon://`) redirect is allowed in staging's or prod's Supabase. The security review of the release setup found that any app can claim a custom scheme, and Supabase's implicit flow then hands it the tokens.
- Links sent before this ships (Supabase's `/auth/v1/verify` link) keep working on the web until they expire (1 hour).
- Apple's "Hide my email" gives a relay address: it is the account's email like any other.
- Someone who first signed in with email and later uses Google or Apple with the same email ends in the same account (Supabase links identities with the same verified email), not a second family.
- Expo Go (`pnpm dev:phone`) keeps working with the email link against local Supabase (`exp://` stays allowed only in `supabase/config.toml`). Google and Apple need a build; they don't show in Expo Go.
- Email security scanners that open links: no worse than today, because Supabase's current link also uses the token up when opened.

## Requirements

- **FR-001 Email link that opens the app**: the sign-in email links straight to the web app's address, `https://app.ourcocon.com/auth/confirm?next=…&token_hash=…&type=email`, instead of Supabase's `/auth/v1/verify`. The app asks for the link with `emailRedirectTo` = `<app URL>/auth/confirm?next=<path>` (always with a `?`), and `apps/app/public/email/sign-in.html` builds `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`. The new `/auth/confirm` route calls `verifyOtp({ token_hash, type: 'email' })`, then goes on like `/auth/callback` (signed_up/signed_in, `next` through `safeNext`). Same template for new and returning people (both Supabase templates already load it).
- **FR-002 Universal Links**: iOS opens `https://app.ourcocon.com/auth/confirm…` in the installed app.
  - `ios.associatedDomains: ["applinks:app.ourcocon.com"]` in `apps/app/app.json`.
  - The web app serves `/.well-known/apple-app-site-association` (JSON, `Content-Type: application/json`, no redirect, no cookie or challenge from Cloudflare) for app ID `59TR87TBX2.com.ourcocon.app`, paths `/auth/confirm` only. Staging serves the same file; it's harmless there.
  - Expo Router opens the `/auth/confirm` route from the link.
- **FR-003 The app's address on iPhone**: `appUrl` returns the web app's `https://` address in builds (new `EXPO_PUBLIC_APP_URL`, set per profile in `eas.json`, read by `lib/config.ts`) and `Linking.createURL` only in local development. Share and invite links built with it then point to the web too.
- **FR-004 Google on iPhone**: the native Google sign-in sheet (`@react-native-google-signin/google-signin`, its config plugin) returns an ID token; the app signs in with `signInWithIdToken({ provider: 'google', token, nonce })`. No redirect. Needs an iOS OAuth client in Google Cloud for `com.ourcocon.app`; Supabase's Google provider accepts both client IDs (web and iOS). On the web, Google stays as it is (redirect to `/auth/callback` with PKCE).
- **FR-005 Apple on iPhone**: `expo-apple-authentication` (`ios.usesAppleSignIn: true`) returns an identity token for a SHA-256 nonce the app makes; the app signs in with `signInWithIdToken({ provider: 'apple', token, nonce })`. Supabase's Apple provider is turned on for staging and prod with client ID `com.ourcocon.app`. Apple only, iPhone only: the web doesn't show it (see Needs your attention).
- **FR-006 Sign in screen on iPhone**: "Continue with Apple" (Apple mark, added to the design system as a Button `brand` mark like Google's "G"), then "Continue with Google", then the email form. Same size and style for both, following Apple's guidelines for the Apple button. On the web: unchanged.
- **FR-007 Server settings**: `infra/provision.sh` adds the Apple provider and the second Google client ID to each environment's sealed Supabase settings, and updates servers that already have them (as it does for `MCP_URL`). It never adds a custom scheme to `ADDITIONAL_REDIRECT_URLS`. `infra/VERSION` goes up. Ask for the values at hidden prompts; document them in docs/operations.md › First-time setup.
- **FR-009 Deleting an account made with Apple**: "Delete my account" (spec 003) revokes the person's Apple sign-in at Apple (`POST https://appleid.apple.com/auth/revoke`), as App Store rules ask. The server keeps what that needs: the refresh token from Apple's first sign-in (exchanged once from the authorization code, stored per user where only the server can read it), and a client secret signed with the Sign in with Apple key (.p8, Key ID, Team ID `59TR87TBX2`), a server secret sealed like the others. If Apple can't be reached, the account is still deleted and the revoke is tried again later; never block the deletion.
- **FR-010 Decided** (Gabriel, 2026-10-31): the email link works in whichever browser or app opens it, once, for 1 hour (FR-001 replaces spec 003's same-browser rule). Apple is iPhone only. If Google's library can't pass a nonce on iOS, turn on "skip nonce check" for Google in Supabase and say so in the Changelog.
- **FR-008 Keep the shared code shared**: `SignInProvider` and `SignInMethod` gain `apple`; the sign-in rules stay in `apps/app/lib/auth.ts` (no second copy for iPhone).

## Success Criteria
- **SC-001**: On a TestFlight build, each of the three ways signs a new person in and lands on "Your name" in under a minute.
- **SC-002**: Tests prove `/auth/confirm` signs in from a valid token, shows the expired state for a used one, and keeps `next` to the app's own paths.
- **SC-003**: The security review confirms no custom scheme is allowed as a redirect in staging or prod.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `signed_up` | method (email, google, apple) (existing event, new value) |
| `signed_in` | method (existing event, new value) |

## Warnings and errors
New copy goes in OC-Welcome.md's States table and `strings/en.ts` first:
| State | Copy |
| --- | --- |
| Apple sign-in couldn't finish | warn Callout "Couldn't sign in with Apple. Try again, or use your email." |
| Google sign-in couldn't finish (iPhone) | existing "Couldn't open Google sign-in. Check your connection and try again." |
| Person closes Apple's or Google's sheet | nothing shown |

"Link opened in another browser" no longer happens for new links (FR-001); keep it for links sent before this ships, then remove it in 032-later.

## Needs your attention
- **Your setup steps** (the build writes them in docs/operations.md):
  - Google Cloud: an iOS OAuth client for `com.ourcocon.app` (its client ID and iOS URL scheme).
  - Apple Developer: a Sign in with Apple key (.p8 file and its Key ID), for FR-009.
  - EAS turns on Sign in with Apple and Associated Domains for the app ID at the next build.
  - Then run `bootstrap-from-laptop.sh` (it asks for the new values) and `pnpm release:ios`.

## Changelog
- 2026-10-31: Draft. Written after the first TestFlight build (0.8.0), where signing in couldn't work: prod's Supabase only allows sign-in to return to `https://app.ourcocon.com`, and the security review rejected allowing `ourcocon://`.
- 2026-10-31: Ready. Decided with Gabriel: the email link works in any browser (replaces spec 003's same-browser rule); Apple on iPhone only; revoke Apple sign-in when an account is deleted, in this spec (FR-009); skip Google's nonce check only if the library needs it.
- 2026-10-31: Built. The email link goes to `/auth/confirm` (`verifyOtp` with the token, any browser) and opens the iPhone app through Universal Links (`/.well-known/apple-app-site-association`, `/auth/confirm` only); iPhone builds make links on `https://app.ourcocon.com`; Apple, then Google sign in with the iPhone's own sheets (`signInWithIdToken`), hidden on the web (Apple) and in Expo Go (both); "Delete my account" revokes Sign in with Apple. Deviations:
  - **Google sends no nonce** (FR-004, FR-010): `@react-native-google-signin/google-signin` 17 takes none on iOS, so Supabase skips Google's nonce check (`GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK`). Apple's nonce is checked.
  - **"Continue with Apple" has an ink label** (Apple's rules: logo and label the same colour); Google's keeps olive-deep. Decided with Gabriel.
  - **FR-009 built as:** tables `apple_tokens` and `apple_revocations` (service key only), a trigger that queues a person's token whenever they are deleted, the Edge Functions `apple-sign-in` (keeps the refresh token, on every Apple sign-in rather than only the first, so a failed first try is caught later; retries the queue) and `delete-account` ("Delete my account" now goes through it for everyone: it runs `delete_my_account` as the member, then revokes), and the nightly purge retrying what Apple didn't take. Caddy opens the two functions.
  - **Join and Approve access** show only the email form inside the iPhone app (on the iPhone they open in the browser, where Google shows as before).
  - **The email link** falls back to `<site>/auth/confirm?next=%2F` when Supabase refuses the redirect, so the token never lands in a malformed address (security review). `/auth/callback` also takes the token, for a web tab still running an older version.
  - `infra/provision.sh` asks for the Google iOS client ID and the Sign in with Apple key, and on every run resets the allowed redirects to the web app only (SC-003). Team ID and bundle ID are written by provision.sh, not `infra/config.env`.
