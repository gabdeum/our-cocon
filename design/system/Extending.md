# Extending the system

Use these rules to design any component this system doesn't have yet, so it looks like it was always there. Work through them in order.

## 1. Reuse before you create

Check whether an existing component plus a variant covers it. Recurring tasks, a calendar day cell or a notification row are usually a `ListRow`, `Card` or `Pill` with different content.

## 2. Build only from tokens

- Colours come from the tokens only, in an allowed pairing (table below). A new colour needs a new token with a usage note and a contrast check.
- Sizes: tappable things are `control-md` (44), fields `control-lg` (54), primary buttons `control-xl` (58).
- Radius by size: under 44 tall → `radius-pill` or `radius-md`; cards → `radius-xl`; large showcase blocks → `radius-2xl`.
- Spacing from the spacing scale only: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28.

## 3. Allowed text and background pairings

| Text | Backgrounds | Contrast |
| --- | --- | --- |
| `ink` | surface-page, surface-card, surface-soft, honey, sage, peach, warn-soft | 10.5–14.5 |
| `ink-muted` | surface-page, surface-card, surface-soft, sage | 5.9–7.9 |
| `olive` | surface-page, surface-card (links, selected text) | 5.8–6.1 |
| `olive-deep` | sage, surface-card, surface-page (SettingChoice example) | 6.7–9.1 |
| `warn` | warn-soft, surface-soft, surface-card, sage (a warning inside a result card) | 5.0–6.8 |
| `on-olive` (white) | olive, ink, danger | 6.1–15.6 |
| `on-ink` | ink | 11.6 |
| `peach-ink` | peach | 5.6 |

Anything not in this table needs a contrast check of at least 4.5:1 before use.

## 4. Pick the emphasis level

1. **Main action** (one per screen): ink fill, white text, pill, 58–60 tall.
2. **Positive or selected:** olive fill, white text.
3. **Warm highlight** (time-related, "now", active): honey fill, ink text.
4. **Calm info** (checks, AI, confirmations): sage fill, ink or olive-deep text.
5. **Secondary:** surface-soft fill, ink text.
6. **Tertiary:** text link in olive, 15/800.
7. **Destructive:** danger fill or danger link, always confirmed by a `Dialog`.

## 5. Every component ships with all its states

Each new component needs: default, pressed (darken fill about 6% or show `surface-soft`), focused (3 px olive outline offset 2), disabled (`on-ink` fill, `ink-muted` text), selected or checked if it applies, loading if it does work, and error or attention (`warn-border` 2 px plus a `warn` message) if it takes input. Add the empty state when it lists things.

## 6. Copy and accessibility

Follow Voice and copy in the README. Give each icon-only control a label, mark switches and toggles with their state, make the touch target at least 44, and test the largest text size.

## 7. Add it to the system

1. Add a `/* ---------- Name ---------- */` section to `components/bundle.css` using `oc-` class names.
2. Add `components/<Name>/README.md`: a one-sentence summary, a Specs table, Variants and states, and Rules.
3. Add `components/<Name>/preview.html` with the `@dsCard` marker, showing its main states.
4. Need a new token? Add it to `tokens.json` with a usage note, and add its pairing to the table above.

## Worked example: a Toast

Need: a short confirmation after an action, such as "Recipe saved".
- **Reuse check:** `StatusBanner` is close but sits inside the layout. A toast floats, so it's a variant: `StatusBanner--floating`.
- **Emphasis:** calm info, so a `sage` fill with ink 15/800 text and an optional Undo link (15/900, underlined).
- **Shape:** min-height 54, radius 18, padding 0 8 0 16. It floats 10 above the tab bar, like the timer pill, with `shadow-float`.
- **States:** appears with a 250 ms fade and stays 4 s (8 s if it has Undo). It's announced with `role="status"`.
