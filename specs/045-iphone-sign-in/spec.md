# Feature Specification: iPhone sign-in

**Feature Branch**: `045-iphone-sign-in` · **Status**: Draft · **Depends on**: 003, the iOS release setup (CLAUDE.md › Releasing (iOS))
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
- **The email link no longer has to be opened in the browser that asked for it.** Spec 003 chose PKCE, so a link worked only in that browser. With FR-001 it works wherever it's opened, like most apps' sign-in links. That's what lets the iPhone app open it, and it removes the "other browser" error. The protection left is the same as today's email: the link works once, for 1 hour. Confirm, or keep PKCE on the web and use the new link only for iPhone requests (two templates, more code).
- **Apple on the web.** FR-005 shows Apple only in the iPhone app; App Store rules only ask for it there. Adding it to the web later needs an Apple "Services ID" and a return address set up in your Apple Developer account.
- **Deleting an account made with Apple.** Apple asks apps to revoke the person's Apple sign-in when they delete their account ("Delete my account", spec 003). That needs a Sign in with Apple key (.p8 file) from your Apple Developer account, stored as a server secret, and a call to Apple when the account is deleted. Do it in this spec (more setup) or list it in 032-later before the App Store release.
- **Google's nonce.** If the Google library can't pass a nonce on iOS, Supabase's Google provider needs "skip nonce check", which weakens replay protection of Google's token. The build says which it is.
- **Your setup steps** (the build writes them in docs/operations.md): Google Cloud → new iOS OAuth client for `com.ourcocon.app`; Apple Developer → nothing by hand (EAS turns on Sign in with Apple and Associated Domains for the app ID at the next build); then run `bootstrap-from-laptop.sh` and `pnpm release:ios`.

## Changelog
- 2026-10-31: Draft. Written after the first TestFlight build (0.8.0), where signing in couldn't work: prod's Supabase only allows sign-in to return to `https://app.ourcocon.com`, and the security review rejected allowing `ourcocon://`.
