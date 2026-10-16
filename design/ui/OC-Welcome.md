# OC-Welcome — Sign in, set up a family, join

Not drawn (described in words; spec 003). Built from existing components: Logo, TextField, Button, Link, Callout, StatusBanner, Dialog. Every page uses the pushed-screen layout without a back link or tab bar, and starts with the mark (56) above a `display-lg` title and a 15/600 muted lead.

## Sign in · `/welcome`
1. Title "Welcome to Our Cocon", lead "Recipes and groceries your whole family shares."
2. Outline button with Google's mark: "Continue with Google".
3. "or" (15/700 muted, centred).
4. TextField "Your email", hint "We'll send you a link to sign in. No password needed."
5. Ink button "Send me a link" (busy: "Sending…").

After sending, the same page shows:
1. Title "Check your email", lead "We sent a link to {email}. Open it on this device to sign in. It works for 1 hour."
2. Outline button "Send it again" → StatusBanner "Sent again. Check your email."
3. Link "Use a different email" → back to the form.

## Sign-in link · `/auth/callback`
While working: "Signing you in…". Then → the invite page it came from, or Home (`/`); with no family yet → Set up your family.

## Set up your family · `/welcome/family`
After the first sign-in, when the person has no family.
1. Title "Set up your family", lead "Everyone you invite will share its recipes and groceries."
2. TextField "Your name", hint "Shown to your family" (prefilled with the first name Google gives; empty for email).
3. TextField "Family name", placeholder "The Smiths".
4. Ink button "Create family" (busy: "Creating…") → Home.

## Join · `/join/[token]`
Opened from an invite link, signed in or not.
- **Signed out:** title "Join {family}", lead "{inviter} invited you to share recipes and groceries.", then the Sign in form (Google and email). Signing in comes back here.
- **Signed in:** same title and lead, TextField "Your name" (hint "Shown to your family"), ink button "Join {family}" (busy: "Joining…") → Home as "Can edit".
- **Already alone in a family of their own:** "Join {family}" first opens a Dialog (warning icon): title "Leave “{own}” and join “{family}”?", body "Your family “{own}” and everything in it will be deleted. This can't be undone.", buttons "Join {family}" (danger) and "Keep mine".
- **In a family with other people:** warn Callout "You're already in a family with other people. Ask its owner to remove you, then open this link again." and ink button "Go to Our Cocon".

## States
| State | Copy and behaviour |
| --- | --- |
| Email mistyped | TextField warning "Check your email address. It should look like name@example.com." Nothing is sent. |
| Sending failed | warn Callout "Couldn't send the link. Check your connection and try again." |
| Google sign-in couldn't open | warn Callout "Couldn't open Google sign-in. Check your connection and try again." |
| Too many tries | warn Callout "Too many tries. Wait a minute, then try again." |
| Link expired or used | title "Our Cocon", warn Callout "This sign-in link has expired or was already used. Ask for a new one.", ink button "Back to sign in" |
| Link opened in another browser | same, with "Open the link in the same browser where you asked for it, or ask for a new one." |
| Name missing | TextField warning "Add your name so your family knows who you are." |
| Family name missing | TextField warning "Give your family a name." |
| Saving failed | warn Callout "Couldn't save. Try again." |
| Invite expired, used or unknown | title "Our Cocon", warn Callout "This invite has expired. Ask for a new one.", ink button "Go to Our Cocon" |

## Sign-in email
Subject "Your Our Cocon sign-in link". Title "Sign in to Our Cocon", body "Tap the button to sign in. The link works once, for 1 hour.", button "Sign in", footnote "Open it on the device where you asked for it. If you didn't ask to sign in, you can ignore this email." Source: `apps/app/public/email/sign-in.html`.
