# Switch

An on/off toggle, always inside a setting row that explains what it does.

## Specs

| Part | Spec |
| --- | --- |
| Track | 52 × 32, radius 16, padding 3; off `line-handle`, on `olive` (on an ink card: `honey`) |
| Knob | 26 circle, white; left when off, right when on |
| Setting row | padding 14 0, 1.5 px `line` divider; label 16/800, hint 13/600 ink-muted, 12 gap to the switch |
| Boxed row | for a recipe's option variants (OC-Recipe › Version): `surface-soft`, radius 18, min height 52, padding 8 × 14, label 15/800, hint 13/600 ink-muted; no divider (`SettingRow boxed`) |
| Ink card | the form's "Advanced mode" (OC-EditBasics): `ink`, radius 18, min height 60, padding 8 × 16, label 16/900 white, hint 13/600 `on-ink`, honey track when on (`SettingRow boxed onInk`) |
| Override hint | "Changed for this recipe · Reset" in `warn` when a recipe overrides a family default |

## Rules

- The whole row is the tap target. `role="switch"` with `aria-checked`.
- The hint says what On (or Off) does, in plain words: "Off: hides temperature checks in steps".
- Changes apply instantly; no Save button for switches.
