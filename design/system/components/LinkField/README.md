# LinkField

A link to send and its one action, side by side: the share link and "Copy link" on the share sheet (OC-Share, spec 019).

## Specs

| Part | Spec |
| --- | --- |
| Field | read-only, flex 1, 54 tall, radius 16, 2 px `line-strong`, surface-card, padding 0 14; value 15/700 ink-muted on one line, truncated |
| Action | ink button 54 tall, radius 16, padding 0 18, label 16/900 white |
| Layout | gap 8 |

## States

The field can hold a state instead of a link: "Creating link…", "Not shared". The action's label changes with it: "Copy link", "Copied ✓" for 2 s after copying, "Create a new link" once stopped. Pressed: ink-pressed. Focus: 3 px olive outline. Disabled (nothing to copy yet): on-ink fill, ink-muted label.

## Rules

- The action is the sheet's one ink button.
- The field is not editable; its screen-reader name is "Link".
