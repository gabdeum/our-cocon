# ScreenHeader

The top of a screen, in three forms: tab title, brand row and form bar. Pushed screens use the TopBar (spec 050), which replaced the back link.

## Specs

| Form | Spec |
| --- | --- |
| Tab title | `display-xl` 32/900 −0.6; optional sub-line 15/700 ink-muted ("7 items to buy · shared with family"); optional right action (small olive Button, presence pill) aligned to the bottom of the title |
| Brand row (Home) | `BrandRow`: mark 34 (honey, radius 11) + "Our Cocon" 18/900 −0.3, gap 8; avatar stack on the right; pinned in `TabScreen` (spec 050 FR-007). `BrandHeader` under it: date 15/700 olive and greeting 32/900 |
| Lead (`Lead`, spec 050) | 15/600 ink-muted, the first line of content under the TopBar |
| Form bar | Cancel (16/800 muted link, 44) · title 17/900 centred · Save (Button olive sm); `Progress` with section names under it |

## Rules

Top padding is 50–54 below the status bar (safe area). Titles are nouns ("Groceries"); greetings use the member's first name.
