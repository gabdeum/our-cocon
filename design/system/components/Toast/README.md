# Toast

The app's one way to confirm or report something that just happened: "Link copied", "Onion removed · Undo", "Couldn't save. Try again." Also the calendar's first-visit hint and floating add button.

Reference: `design/screens/OC-CalDay.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Toast | the StatusBanner card (sage, radius 18, min 54, padding 0 8 0 16, 15/800; trailing button 44 tall, 15/900 underlined), with `shadow-lift`. `warn` tone (warn-soft, warn text) when something failed |
| Position | floats over the screen, 12 below the status bar (under the iPhone notch), 16 from the sides, max the frame width. Over sheets, dialogs and full-screen modals too |
| Timing | 5 s, or 8 s when it has a button; then it goes. Tapping the button closes it. `role="status"` |
| Hint | sage, radius 20, padding 12 14, 14/800 ink (line-height 1.35), white "Got it" pill 44 (15/900), `shadow-lift`; 16 from the left, 92 from the right (beside the add button), 112 from the bottom. Stays until "Got it" (OC-CalMonth, spec 037) |
| Floating add | IconButton `--fab`, 20 from the right and 112 from the bottom (`FloatingAdd` in packages/ui places it with the hint) |

## Rules

- Every confirmation and failure message uses the toast; none is placed in the screen's layout. Where a UI spec says "banner" for one, it means this toast.
- One at a time: a new toast replaces the one showing.
- The button is "Undo", or another single action ("Open timers"). When an Undo fails, a warn toast says so: "Couldn't undo. Check your connection and try again." (spec 042, 032-later L99), or the screen's own words.
- Calendar text format: "{title} added for {when}, {time range}."
- Not toasts: states that last, shown in the layout until they change: offline (StatusBanner `warn`, Patterns.md › Offline) and "Alex just changed this recipe · Reload".
- Hint: one first-visit tip, then gone for good for that person.
- Built in `packages/ui`: `ToastProvider` (once, around the app), `useToast().show({ text, tone, actionLabel, onAction })`, `ToastHost` (already inside BottomSheet, Dialog, FormScreen and CookLayout, so the toast draws on the modal on top), `Toast` (the hint) and `FloatingAdd`. The app's `lib/toast.tsx` adds `onUndo`.
