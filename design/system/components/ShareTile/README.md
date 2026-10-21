# ShareTile

A way to send something, in a row of three under a link: "Message", "Email" and "More" on the share sheet (OC-Share, spec 019).

## Specs

| Part | Spec |
| --- | --- |
| Shape | 76 tall, radius 18, fills its cell of a three-column grid; grid gap 10 |
| Fill | `--honey` for the first tile (the likeliest way to send), `--soft` (surface-soft) for the others |
| Content | icon 22 (ink) over the label 14/800 ink, 6 apart, centred |

## States

Pressed: honey-pressed or surface-soft-pressed. Focus: 3 px olive outline, offset 2. Disabled (nothing to send yet, e.g. the link is "Not shared"): on-ink fill, ink-muted icon and label.

## Rules

- The label is the screen-reader name; the icon is decorative.
- Each tile opens the system share sheet (or its fallback); the sheet's one ink button stays the main action ("Copy link").
