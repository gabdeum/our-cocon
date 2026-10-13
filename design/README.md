# Design sources for Claude Code

Three layers describe every screen. When building a screen, read all three.

| Layer | Where | Binding for |
| --- | --- | --- |
| Design system | `design/system/` (start with `design/system/README.md`) | How components look: sizes, colours, states. Build only with `packages/ui`. |
| Screen source | `design/screens/<Screen>.dc.html` | **Structure and exact copy:** which components, in which order, with which words. |
| UI spec | `design/ui/<Screen>.md` | **Behaviour:** states not drawn (empty, error, loading), dynamic strings, interactions and navigation, data sources. |

If two layers disagree: the UI spec wins on behaviour and copy, the screen source wins on order and layout, and the design system wins on visuals. Report any conflict in the PR.

## Design system files (`design/system/`)

- `README.md`: principles, voice and copy, colour, type, spacing, icons, accessibility. Start here.
- `tokens.json`: the only source of design values. `pnpm theme` turns it into the NativeWind config and `packages/ui/theme.ts`; never hard-code values.
- `components/<Name>/README.md`: specs, variants and states for each of the 24 components. `components/bundle.css` is the reference implementation; port it 1:1 with the theme classes.
- `components/<Name>/preview.html`: example markup, rendered only inside the design-system viewer. Reference, not runnable pages.
- `Patterns.md`: screen layouts. `Extending.md`: how to design a missing component (the `add-component` skill follows it).
- `assets/Icons/*.svg`, `assets/Logos/our-cocon-mark.svg`: use via `react-native-svg`; don't redraw.

## Reading a `.dc.html` screen source

- Everything inside `<x-dc>` is the screen at 390 px wide. Inline `style="…"` values are the design system's tokens written out (see the table below). Implement them with `packages/ui` components, not by copying styles.
- `{{name}}` is a value computed in the `<script>` at the bottom (`renderVals()`). The script holds the screen's demo logic: read it to learn dynamic strings ("Add 3 items", "Done!") and behaviour (timers, scaling, toggles).
- `<sc-for list="{{items}}" as="item">` is a repeated list; `<sc-if value="{{cond}}">` is a conditional block.
- `<dc-import name="TabBar" …>` places another component screen (`TabBar.dc.html`).
- `<a href="OC-Recipe.dc.html">` is a navigation target. Map it to the route in `flows.md`.
- Text inside `[Brackets]` is a placeholder for real content (photos, links).
- Sample data (the quiche, Alex, Mia, quantities) is example content, not fixed text. Real data comes from the database.

## Inline value → token

| Value in source | Token |
| --- | --- |
| `#FFF8E3` | surface-page |
| `#FFFFFF` | surface-card / on-olive |
| `#FFF0C9` | surface-soft |
| `#FFCF5C` | honey |
| `#D9E3A8` | sage |
| `#5A6820` | olive |
| `#424D17` | olive-deep |
| `#A9B46A` | olive-muted |
| `#2A2414` | ink |
| `#5A503A` | ink-muted |
| `#8F866C` | ink-faint |
| `#3E3622` | ink-raised |
| `#E6DFC9` | on-ink |
| `#F5D9A8` / `#6B4E1E` | peach / peach-ink |
| `#F2E6C4` · `#F7EED6` | line |
| `#EEDFB5` | line-strong |
| `#CDBF95` | line-dashed |
| `#D8CBA4` | line-handle |
| `#FFE3C2` / `#8A4B00` / `#E8A04A` | warn-soft / warn / warn-border |
| `#9A3412` | danger |
| `#8C8268` (sheet backdrops) | scrim (the source draws it solid; the app uses the translucent token over the real screen) |
