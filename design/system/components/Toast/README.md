# Toast

The app's one way to confirm or report something that just happened: "Link copied", "Onion removed · Undo", "Couldn't save. Try again." Also the calendar's first-visit hint and floating add button.

Reference: `design/screens/OC-CalDay.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Toast | the StatusBanner card (sage, radius 18, min 54, padding 8 8 8 16, text 15/800 on the left, wrapping, never cut), with `shadow-lift`. `warn` tone (warn-soft, warn text) when something failed |
| Buttons (spec 053) | on the right, 8 apart, each a 40 round button that belongs to the toast (touch 44): no shadow, `toast-button` fill (ink at 8% over the toast's colour, 16% pressed; IconButton `tint`), a 20 icon in the toast's text colour (ink, or warn on a failure): Undo (`undo`, "Undo"), Try again (`retry`, "Try again"), then always ✕ (`close`, "Dismiss"). An action an icon can't say ("Open timers") keeps its text button (44 tall, 15/900 underlined) before the ✕ |
| Position | floats over the screen, 12 below the status bar (under the iPhone notch), 16 from the sides, max the frame width. Over sheets, dialogs and full-screen modals too |
| Timing | 5 s, or 8 s with Undo; then it goes. A failure (`warn`) stays until ✕, its button or the next toast. Tapping any button closes it. `role="status"` |
| Hint | sage, radius 20, padding 12 14, 14/800 ink (line-height 1.35), white "Got it" pill 44 (15/900), `shadow-lift`; 16 from the left, 92 from the right (beside the add button), 112 from the bottom. Stays until "Got it" (OC-CalMonth, spec 037) |
| Floating add | IconButton `--fab`, 20 from the right and 112 from the bottom (`FloatingAdd` in packages/ui places it with the hint) |

## Rules

- Every confirmation and failure message uses the toast; none is placed in the screen's layout. Where a UI spec says "banner" for one, it means this toast.
- One at a time: a new toast replaces the one showing.
- Buttons: Undo or Try again (round, icon only), or another single action ("Open timers"); ✕ on every toast, which only hides it. When an Undo fails, a warn toast says so: "Couldn't undo. Check your connection and try again." (spec 042, 032-later L99), or the screen's own words.
- Calendar text format: "{title} added for {when}, {time range}."
- Failures included: a save, delete, copy, undo or load that failed is a `warn` toast, never a Callout or StatusBanner in the layout (spec 053).
- Not toasts: messages tied to a field (under it); states that last, shown in the layout until they change: offline (StatusBanner `warn`, Patterns.md › Offline), "Alex just changed this recipe · Reload", a recipe deleted by someone; hints and questions (Callout tip/info/ai/temp, the calendar conflict).
- Hint: one first-visit tip, then gone for good for that person.
- Built in `packages/ui`: `ToastProvider` (once, around the app), `useToast().show({ text, tone, actionLabel, actionIcon, onAction })`, with `ToastProvider`'s `dismissLabel` and `onDismiss`, `ToastHost` (already inside BottomSheet, Dialog, FormScreen and CookLayout, so the toast draws on the modal on top), `Toast` (the hint) and `FloatingAdd`. The app's `lib/toast.tsx` adds `onUndo` and `retry` (round, icon only) and counts the ✕ (`toast_dismissed`).
