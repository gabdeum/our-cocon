# Swipeable

Behaviour wrapper for week and day views.

Reference: `design/screens/OC-CalWeek.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Drag | content translates with the pointer (touch-action: pan-y keeps vertical scroll); opacity eases to 0.35 at 400 px |
| Commit | |dx| ≥ 60 px → next/previous; new content enters from the swipe side, 220 ms ease-out |
| Cancel | < 60 px snaps back |
| Reduced motion | no slide, instant swap |

## Rules

- Header arrows trigger the same transition.
