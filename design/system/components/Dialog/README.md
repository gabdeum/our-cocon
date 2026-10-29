# Dialog

A centred confirmation for destructive or irreversible actions. It's the only modal dialog in the app.

## Specs

| Part | Spec |
| --- | --- |
| Scrim | `scrim` |
| Box | surface-page, radius 30, padding 24 20 20, gap 14, centred, 20 from the screen edges, text centred |
| Icon | 60 disc warn-soft holding a 28 px icon in danger |
| Title | 22/900, the action as a question: "Delete “Leek & bacon quiche”?" |
| Body | 16/600 ink-muted, line-height 1.45: the consequence and the way back ("…for 30 days."); one optional part in bold ink (`emphasis`: "Recently deleted") |
| Buttons | full width, stacked: danger 56 ("Delete recipe"), then soft 56 ("Keep it") |
| Second choice (spec 042) | optional, between them: danger outline 56 (white, 2 px danger border, danger 16/900): "Only this one" / "This and all future ones" / "Keep it" (OC-CalEventDelete) |

## Rules

- `role="alertdialog"`, labelled by the title and described by the body. Focus starts on the safe button.
- Never use a dialog for information. Use a Callout or StatusBanner instead.
