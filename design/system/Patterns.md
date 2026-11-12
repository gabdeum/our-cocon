# Screen patterns

These are the layouts every Our Cocon screen is built from. Compose new screens from them before inventing a new one.

## Tab screen (Home, Recipes, Groceries, Settings)

- Background `surface-page`. Padding is 54 top (under the status bar), 20 sides and 180 bottom, leaving room for the tab bar and timer pill.
- Top: a `ScreenHeader` with a `display-xl` title, an optional one-line `screen-sub` beneath it, and an optional action on the right (small olive Button "New", or a presence pill).
- Then content blocks 14–18 apart: search, pills row, overline plus list group, cards.
- Pinned part (spec 050 FR-007, `TabScreen` `pinned`): the status bar area becomes a `surface-page` band (safe area, at least 54) and the pinned part sticks under it, getting the TopBar's hairline and `shadow-bar` once content is under it; a `header` above it scrolls away. Home pins the brand row, Recipes the search and pills row, Groceries the Add row.
- The `TabBar` floats 16 from the sides and 26 from the bottom. The `TimerPill` sits centred 10 above it while any timer exists.

## Pushed screen with photo header (recipe page, shared recipe)

- Photo 240 tall, edge to edge. Round white `IconButton`s (`--round`, 40) in the TopBar sit 52 from the top and 16 from the sides: back on the left, actions on the right, 8 apart.
- The content sheet overlaps the photo by 30 with top radius 30, `surface-page`, padding 24 × 20.
- The action bar (spec 051) sits fixed at the bottom on a cream fade (`surface-page` from clear to full by 26%, padding 14 × 16 × 28), always in reach while the page scrolls under it: a 60 cart button (IconButton `--outline`; from 430 wide an outline `lg` Button "Add to groceries") and the main CTA filling the rest (ink, 60, play icon, "Start recipe" or "Resume · step 3"). The `TimerPill` sticks centred 108 from the top while timers exist.
- In the app: `PhotoScreen` (packages/ui Layout), with the photo, the left and right buttons and the content.

## Public page (shared recipe)

- For pages anyone can open without an account (OC-SharedView, spec 019). No tab bar, no back button.
- A white header bar 64 tall with a 1.5 px `line` border: the 30 px mark and "Our Cocon" 16/900 on the left, a sage Tag ("View only") on the right.
- Then the photo 220 tall, edge to edge (left out on a state with no recipe), and the content with padding 20 × 20 × 40, blocks 16 apart.
- In the app: `PublicScreen` (packages/ui Layout).

## Pushed screen without photo (settings sub-pages, timers)

- The TopBar (spec 050), pinned: round back button, the title centred (17/900), up to two round actions. The lead (15/600 muted) is the first line of content; there is no other title. Detail pages (recipe, event) keep a `display-lg` heading in the content and the bar shows the name once it scrolls under it.

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

- The header is fixed: the round ✕ (IconButton `--round`, "Exit cooking mode"), and on the right the `TimerPill` while timers run, then a round settings IconButton that opens the "Cooking options" sheet. Then the cook `Progress` bar (tappable segments) and "Step N of M".
- Every step sits in one scrolling column with scroll-snap. The current step is at full opacity and the others at `opacity-dimmed`.
- The footer is fixed: a soft Back (1/3) and an olive Next (2/3), both 60 tall. On the last step Next reads "Done cooking" (still olive), which logs the cook (spec 051). Back always reads "Back"; on the first step it leaves cooking mode, which keeps the cook in progress.

## States that every list needs

- **Empty:** a centred `body` muted sentence that says what to do ("No timers running. Start one from any recipe step."), plus the screen's primary action.
- **Loading:** skeleton blocks in `surface-soft` at the size of the real content, with no spinners on cards.
- **Error:** a `warn` Toast with the plain-language cause, a round Try again and ✕ (spec 053); the list keeps its skeleton or what it had. Messages tied to one field stay under that field.
- **Offline:** a `StatusBanner` in `warn-soft` at the top of the content: "You're offline. You can read, but changes need a connection."
