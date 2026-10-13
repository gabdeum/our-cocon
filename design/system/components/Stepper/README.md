# Stepper

Minus / value / plus for small whole numbers, mainly servings.

## Specs

| Part | Spec |
| --- | --- |
| Minus | IconButton `--soft` 44 circle, "−" 22/800 |
| Value | 22/900, width 28, centred, tabular numerals |
| Plus | IconButton `--olive` 44 circle, "+" white 22/800 |
| Gap | 8 |
| In a card | Servings card: white, radius 22, padding 12 12 12 16; label "Servings" 17/900 on the left, then the stepper, then a 44 `--square` "More options" button 4 to the right |

## Rules

- Range 1–16 servings. At a limit, the button stays visible but does nothing and is announced as dimmed.
- Changing the value updates every quantity on the page at once. No Apply button.
