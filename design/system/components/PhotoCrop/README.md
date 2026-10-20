# PhotoCrop

The step after picking a photo: the photo under a fixed 13:8 frame (the recipe header), dragged to place and zoomed, then kept (spec 014 FR-004).

## Specs

| Part | Spec |
| --- | --- |
| Screen | `surface-page`, padding 50 20 24, gap 18 |
| Title | `titleLg`, then a caption hint in `ink-muted` |
| Frame | full width, 13:8, radius 22, `ink` behind the photo |
| Zoom | two soft sm buttons side by side ("Zoom out", "Zoom in"), 1× to 3× in steps of 0.5 |
| Footer | soft "Cancel" (110 wide) and olive "Use photo" (fills the rest), gap 10 |

## States

The photo starts centred and covering the frame; it can never be dragged to show an edge. Zoom out is disabled at 1×, Zoom in at 3×. Screen-reader users keep the centred crop and reach every button.

## Rules

- One fixed shape: there are no free-form crops in V1 (decision 14).
- Use photo returns the rectangle in image pixels; the app crops and resizes (max 2000 px) before upload.
