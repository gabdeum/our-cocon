# SegmentedControl

Two to four mutually exclusive options in one track: units, store profile, and the Ingredients / Steps tabs.

## Specs

| Variant | Track | Item | Selected |
| --- | --- | --- | --- |
| light (default) | surface-soft, radius 14, padding 4, gap 4 | 44 tall, radius 11, ink-muted 14/700 | white, ink 900, `shadow-segment` |
| `--pill` | as light, radius pill | 36 tall, padding 0 14 | same |
| `--tabs` (dark) | ink, radius 20, padding 5 | 48 tall, radius 16, on-ink 16/700 | honey, ink 900, no shadow |

Items share the width equally (pill: hug content).

| State | Look |
| --- | --- |
| Disabled (offline) | track at `opacity-dimmed`, not tappable; the choice still shows (spec 021) |
| Pill touch area | 36 tall, with a 4 px hit slop above and below so it reaches 44 |

## Rules

- Use `--tabs` only to switch the view of the same content (Ingredients · 9 / Steps · 6). Counts follow a middle dot.
- Labels that need a unit hint carry it inline: "Metric · g, ml, °C".
- `aria-pressed` for settings and `role="tab"` + `aria-selected` for tabs.
