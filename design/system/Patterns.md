# Screen patterns

These are the layouts every Our Cocon screen is built from. Compose new screens from them before inventing a new one.

## Tab screen (Home, Recipes, Groceries, Settings)

- Background `surface-page`. Padding is 54 top (under the status bar), 20 sides and 180 bottom, leaving room for the tab bar and timer pill.
- Top: a `ScreenHeader` with a `display-xl` title, an optional one-line `screen-sub` beneath it, and an optional action on the right (small olive Button "New", or a presence pill).
- Then content blocks 14–18 apart: search, pills row, overline plus list group, cards.
- The `TabBar` floats 16 from the sides and 26 from the bottom. The `TimerPill` sits centred 10 above it while any timer exists.

## Pushed screen with photo header (recipe page, shared recipe)

- Photo 240 tall, edge to edge. Round white `IconButton`s (48) sit 52 from the top and 16 from the sides: back on the left, actions on the right, 8 apart.
- The content sheet overlaps the photo by 30 with top radius 30, `surface-page`, padding 24 × 20.
- The main CTA (ink, 60, "Start cooking") ends the content. The `TimerPill` sticks centred 108 from the top while timers exist.
- In the app: `PhotoScreen` (packages/ui Layout), with the photo, the left and right buttons and the content.

## Pushed screen without photo (settings sub-pages, timers)

- A back link (olive, 16/800, chevron) 44 tall at the top-left, then a `display-lg` title and a `body-sm` muted lead.

## Bottom sheet (filters, scale by ingredient, converter, share, add to groceries)

- `scrim` over the screen. The sheet is `surface-page` with top radius 32, padding 12 × 20 × 28 and a handle 44 × 5.
- `title-lg` title, an optional lead, then content 16 apart.
- The footer is either one full-width ink button, or a soft Cancel (≈110 wide) plus an ink primary that fills the rest.
- The sheet height hugs its content, up to 92% of the screen; the content area scrolls, the footer doesn't.

## Dialog (destructive confirm)

- Centred, 20 from the sides, `surface-page`, radius 30.
- From top to bottom: a `warn-soft` disc with a `danger` icon, the title, the body, a danger button, then a soft "Keep it". Use it only for destructive or irreversible actions.

## Form (create/edit recipe)

- A form bar with Cancel (muted link) on the left, the title (17/900) in the centre and a small olive Save button on the right.
- Under it, `Progress` with named sections (Details · Ingredients · Steps · Variants), each tappable.
- Fields 18 apart. An "Advanced mode" switch on an ink card reveals extra fields inline.
- The last block is an ink "Next: <section>" button. On the last section it becomes "Save recipe", followed by a danger link.

## Cooking mode

- The header is fixed: Exit (soft pill), and on the right either the `TimerPill` or the "Screen stays on" chip. Then the cook `Progress` bar (tappable segments) and "Step N of M".
- Every step sits in one scrolling column with scroll-snap. The current step is at full opacity and the others at `opacity-dimmed`.
- The footer is fixed: a soft Back (1/3) and an olive Next (2/3), both 60 tall.

## States that every list needs

- **Empty:** a centred `body` muted sentence that says what to do ("No timers running. Start one from any recipe step."), plus the screen's primary action.
- **Loading:** skeleton blocks in `surface-soft` at the size of the real content, with no spinners on cards.
- **Error:** a `warn` Callout with the plain-language cause and a retry button.
- **Offline:** a `StatusBanner` in `warn-soft` at the top of the content: "You're offline. You can read, but changes need a connection."
