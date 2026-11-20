# PhotoViewer

A photo seen whole, full screen (spec 066): a step's photo in cooking mode. `StepPhoto` is the small square that opens it.

## Specs

| Part | Spec |
| --- | --- |
| `StepPhoto` | square, 72 on the phone, 96 from 600; `radius-lg` (16), cover, `surface-soft` while loading; a button "See the photo for Bake larger" |
| Viewer | full-screen modal on `scrim`, fade (none with Reduce Motion); the photo `contain`, padding 24; a `dialog` named after the photo |
| Close | IconButton `--round` with the close icon 20, top right 16 from the edges, "Close photo" |

## Rules

- Tapping anywhere, Esc or the system back closes it; focus goes back to the thumbnail.
- Never a full-width photo in cooking mode: the step's text stays first.
