# Our Cocon

Our Cocon is a family household app for recipes and groceries, used by everyone from kids to grandparents. This design system is the single source for how it looks: warm, cozy, happy, and so clear that nobody needs help to use it.

## How to use this system (read first)

- **`tokens.json` is the source of truth.** Every colour, text style, spacing step, radius, shadow and size has a name and a usage note. Generate the app theme from it (e.g. `theme.ts` for Expo); never hard-code a value that has a token.
- **`components/bundle.css` is the reference implementation.** It shows every component's exact sizes, colours and states using only tokens. Port it 1:1: px stay px, `var(--olive)` becomes `theme.color.olive`.
- **Each `components/<Name>/README.md` holds the specs** (anatomy, sizes, states, rules) and its preview shows it live.
- **Layouts live in `Patterns.md`.** How to make a component that doesn't exist yet lives in `Extending.md`; follow it so new pieces look native.
- **Stack mapping (Expo).** Font: `@expo-google-fonts/nunito` (weights 500–900). Icons: the SVGs in Assets › Icons via `react-native-svg` (24 × 24, stroke 2–2.6, round caps). Shadows: `shadowColor/Offset/Opacity/Radius` on iOS plus `elevation` on Android, matching the shadow tokens. Checkbox colour: `olive`.
- **Design width is 390 px** (iPhone 14/15). On the web the same mobile layouts are centred at a maximum content width of 720 px. A dedicated desktop layout hasn't been designed yet.

## Principles

1. **Warm, never cold.** Cream ground, honey and sage fills, ink instead of black. No pure greys, no blue.
2. **One obvious next step.** Each screen has a single dark or olive main action. Everything else is softer.
3. **Readable from arm's length.** Body text is 16 px or more, and cooking text is 21 px. Labels are bold. Numbers are big.
4. **Forgiving.** Every destructive or AI-made change shows who did it and offers Undo. Warnings explain what to do, not just what's wrong.
5. **Soft and round.** Pills, large radii, round buttons. Nothing sharp, nothing thin.

## Voice and copy

- Plain words, sentence case, short sentences. Buttons start with a verb: "Start cooking", "Add 3 items", "Copy link".
- Speak to the person ("you", "your family"). Never use technical words like MCP, sync or server in the UI.
- Every field or switch that could confuse someone gets a one-line hint underneath: "Shows cups and spoons instead of grams".
- Warnings say how to fix it: "Pick a unit so we can convert and scale it."
- Quantities always carry units: "300 ml", "1 h 10". Counted items also show their weight: "2 leeks (300 g)". Temperatures show both scales, the preferred one first: "180 °C (350 °F)".
- AI changes are attributed: "Added by Alex via ChatGPT · 1 h ago".
- Example prompts for AI assistants appear in curly quotes: “Add what I need for the quiche to our groceries.”

## Colour

| Role | Token | Use |
| --- | --- | --- |
| Ground | `surface-page` | Every screen, sheet and dialog background |
| Raised | `surface-card` | Cards, list groups, inputs |
| Soft | `surface-soft` | Secondary buttons, unselected pills, tips, highlights |
| Warm accent | `honey` | Active tab, timers, step numbers, highlights. Ink text only |
| Calm accent | `sage` | Temperature checks, AI hints, confirmations, "Variant" tags |
| Action | `olive` | Primary olive buttons, selection, switches, checkboxes, links |
| Text and dark UI | `ink`, `ink-muted` | All text; the main dark button, tab bar and timer card |
| Warning | `warn`, `warn-soft`, `warn-border` | Things to buy, fields to fix, chef's-tip label |
| Destructive | `danger` | Delete only |

Rules:
- Text on `honey`, `sage`, `peach`, `surface-soft` and `warn-soft` is always `ink` (or `olive-deep` on sage, `warn` on warn-soft). Never white.
- White text only on `olive`, `ink` and `danger`.
- At most one olive-filled control group per screen region, and at most one ink main button per screen.
- `ink-faint` is only for struck-through done items; it fails 4.5:1 on purpose.
- The only theme is Light. Dark mode hasn't been designed yet.

## Typography

Nunito is the only family. Weights: 600 for body, 700–800 for labels, 900 for titles, numbers and primary buttons. Use the text styles in tokens.json: `display-xl` 32, `display-lg` 28, `title-lg` 24, `title-md` 22, `title-sm` 18, `label-lg` 17, `body-cook` 21, `body-lg` 17, `body` 16, `body-sm` 15, `caption` 13, `overline` 13, `tag` 12.

- Nothing a person must read or act on is smaller than 13 px. Tags (12 px) are the only exception.
- Timers and counters use tabular numerals.
- Overlines are uppercase through the style; write them in sentence case.

## Spacing, shape and elevation

- Screen gutter 20. Sections 18 apart. Card padding 16. Rows 10 × 14 inside list groups.
- Radii: 6 inline highlight · 11 segmented item · 14 small square · 16 input/callout · 22 card · 28 hero/timer · 32 sheet top · 999 pills and buttons.
- Borders: 2 px on inputs (`line-strong`, `olive` when focused), 1.5 px row dividers (`line`), 2 px dashed for "Add …" buttons (`line-dashed`).
- Shadows only on things that float: `shadow-nav` (tab bar), `shadow-float` (timer pill), `shadow-segment` (selected segment). Cards are flat.
- Touch targets are at least 44 × 44 px, always.

## Iconography

Line icons on a 24 px grid: stroke 2.2 (2.4–2.6 for chevrons, close and plus), round caps and joins, no fills except "more" and "play". They're drawn in `ink` by default, `on-ink` on the tab bar and `olive` in the timer pill. Shown at 24 px in the tab bar and stat tiles, 20 px in buttons, pills and callouts. The set is in Assets › Icons; any new icon must follow the same grid and stroke. They match Lucide's style, so `lucide-react-native` with `strokeWidth={2.2}` is an acceptable source.

## Motion

Keep it quiet. Use 250 ms ease-out for opacity and colour changes, smooth scrolling between cooking steps, and native sheet slide-up. No bounces and no confetti. Respect Reduce Motion.

## Accessibility

- Contrast is at least 4.5:1 for text (checked for every pairing above), and at least 3:1 for borders and icons.
- Every icon-only button has a label ("Share recipe", "One minute more").
- Switches use `role="switch"`, segmented controls use pressed or selected states, and timers are announced politely.
- Layouts must survive the largest system text size: wrap rows, don't truncate amounts.
