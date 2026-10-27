# IconTile

A small square with one icon that leads a card and says what kind of thing the card is: a version (sage, swap icon) or an option (honey, plus icon) in the Variants list on recipe settings (OC-RecipeSettings, spec 017). With letters instead of an icon, it leads an assistant's row in Settings › AI assistants (OC-Connect, spec 025).

## Specs

| Part | Spec |
| --- | --- |
| Shape | 40 × 40, radius 12, never shrinks |
| Fill | `--sage` or `--honey`; assistants: `--peach` (Claude), `--sage` (ChatGPT), `--soft` (surface-soft, Gemini) |
| Icon | 20 px (`icon-sm`), ink |
| Letters | instead of the icon: 16/900 ink, one or two letters ("C", "Ge") |
| Layout | first in a card's row, gap 12 to the text, aligned to the top |

## States

None: it isn't tappable. The card it leads is the tap target.

## Rules

- Decorative: hidden from screen readers; the card's label says the same thing in words.
- Tone has a meaning (sage = a version you pick, honey = an option you add). Never decorative colour.
