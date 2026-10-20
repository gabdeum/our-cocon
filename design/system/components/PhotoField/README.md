# PhotoField

A form's optional photo: a dashed "Add a photo" button, then the photo in the recipe header's shape with "Change photo" and "Remove" (OC-EditBasics).

## Specs

| Part | Spec |
| --- | --- |
| Empty button | 150 tall, radius 22, 2 px dashed `line-dashed`, `surface-soft` fill; camera icon 28 over 15/800 `ink-muted` label, gap 8 |
| Photo | full width, 13:8 (the 390 × 240 header), radius 22, cover |
| Actions | olive link "Change photo" and danger link "Remove", 16 apart, 6 under the photo |
| Uploading | photo at `opacity-dimmed`, caption `ink-muted` under it ("Uploading photo…") |

## States

Pressed: 90% opacity. Focus: 3 px olive outline. Disabled: no press. While uploading, "Change photo" is disabled and the caption is a `role="status"`. An upload error is a warn `Callout` under the field, from the screen.

## Rules

- Optional by nature: the label says "(optional)".
- The photo is always shown as it will look in the header, so crop first (PhotoCrop).
