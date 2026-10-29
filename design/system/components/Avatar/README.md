# Avatar

A family member's initial in their member color, alone or stacked.

## Specs

| Variant | Spec |
| --- | --- |
| default | 36 circle, 2 px `surface-page` ring, initial 14/900 ink |
| `--lg` | 40, no ring, 16/900 (Settings › Family rows) |
| `--xl` | 48, no ring, 18/900 (OC-CalBusy's sheet, spec 043) |
| `--sm` | 32, no ring (inside person pills) |
| Colors | the member's color (`member-honey` … `member-clay`, spec 033); `member-everyone`, `member-others` (with a 1 px `line-handle` outline) and `member-removed` for events |
| Initials | one letter; two when an earlier member has the same one ("Ev", "El") |
| Stack (`oc-avatars`) | overlap −10, most recent first, up to 4 then "+N" |

## Rules

A member's color is the same everywhere (avatars, chips, events, filters) and always comes with their initial. Use a photo if the member uploads one, at the same size.
