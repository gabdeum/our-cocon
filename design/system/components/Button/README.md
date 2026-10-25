# Button

Pill-shaped buttons for actions, from the one main step on a screen (ink) down to soft secondary and dashed "Add …" actions.

## Specs

| Part | Spec |
| --- | --- |
| Shape | `radius-pill` (dashed: 18, tile: 12), no border unless the variant has one |
| Height | default 58 · `--lg` 60 (cooking mode, recipe CTA) · `--sm` 44 (header Save, "New", Connect) · outline and dashed 54 (outline `--lg` 60, beside an ink `--lg`) · tile 44 |
| Padding | 0 24 (sm: 0 18); full width with `--block` |
| Label | Nunito 17/900 (sm 15/900, lg 18/900; soft, outline and dashed 15–16/800) |
| Icon | optional, 20 px, 10 before the label |
| Provider mark | sign-in only: the provider's own 20 px mark in place of the icon, on `outline` ("Continue with Google", spec 003; Logos/README.md) |

## Variants

| Variant | Fill / text | Use |
| --- | --- | --- |
| `ink` | ink / white | The one main forward action: Start cooking, Save recipe, Show 12 recipes, Copy link |
| `olive` | olive / white | Positive confirm inside a region: Save (form bar), Next step, Connect, New |
| `honey` | honey / ink | Time actions: Start timer, Save to my Our Cocon |
| `soft` | surface-soft / ink | Cancel, Back, Keep it |
| `outline` | white, 2 px olive / olive-deep | Secondary action on a content page: Add to groceries… |
| `dashed` | transparent, 2 px dashed line-dashed / olive-deep | Add a step, Add ingredient, Invite someone, Add a variant |
| `tile` | surface-card, 2 px line-strong / ink 14/800 | A choice in a two-column grid of actions: "Add a change" (OC-EditVariants). Pressed: surface-soft |
| `danger` | danger / white | Delete recipe (in a Dialog only) |
| link | text olive 15/800 (danger, warn and muted versions; warn for "Stop sharing this link"); optional 18 px icon 8 before the label, in its colour | Tertiary: Clear all, See all, Stop sharing, Delete this recipe (trash icon) |

## States

Pressed: darken the fill about 6%. Focus: 3 px olive outline, offset 2. Disabled: on-ink fill with ink-muted text ("Nothing selected"). Busy: keep the width and swap the label for "Saving…".

## Rules

- One ink button per screen. Button pairs in a footer: soft secondary on the left (about a third of the width), the primary on the right.
- Labels are verbs and can carry a count: "Add 3 items".
- A label stays on one line. Where it may not fit (two buttons side by side), give a short label ("Cook", "Groceries"): it shows when the full one doesn't fit, and buttons in a pair go short together. Screen readers keep the full label.
