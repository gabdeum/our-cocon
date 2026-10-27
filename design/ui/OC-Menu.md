# OC-Menu — Menu (the last tab)

Source `screens/OC-Menu.dc.html` · Route `/menu` (`/settings` redirects here) · Spec 029

## Layout
1. Title "Menu" (32/900).
2. **Apps** (18/900): `<nav aria-label="Apps">`, 3-column grid, gap 10, of AppTile links: Calendar "{n} today" · Recipes "{n} recipes" · Groceries "{n} to buy". Each opens its tab. Future apps without a tab are added here as more tiles.
3. **Settings** (18/900), three white cards (radius 22, padding 4 16, gap 10):
   - Family "{names} · your account" › · AI assistants "{n} connected" (olive-deep) ›
   - Calendar "Your view, times of day" › · Recipes "Cooking defaults, units" › · Groceries "Where you shop, store sizes" ›
   - Recently deleted "{n} item(s)" › (a plain 56 px row card, no icon)
   Rows: ListRow 64 tall, 36 px icon tile (`surface-soft`, radius 12, 20 px ink icon), title 16/800, detail 13/600 ink-muted, chevron.
4. TabBar (Menu active).

## States
| State | Copy |
| --- | --- |
| Calendar tile, nothing today | "Nothing today" |
| Recipes tile, none yet | "No recipes yet" |
| Groceries tile, list empty or all ticked | "All done" |
| AI assistants, none | "Not connected" (ink-muted) |
| Recently deleted, empty | "Empty" |

## Behaviour
Tiles switch tabs (the tab bar selection follows). Rows push the settings pages; each has the back link "Menu".

## Recently deleted (spec 018, not drawn)
Route `/settings/deleted`, pushed from the "Recently deleted" row ("{n} recipe(s) ›", recipes deleted in the last 30 days). Built from ScreenHeader (back link "Menu", title "Recently deleted") and one ListGroup, newest first.

| Element | Copy and behaviour |
| --- | --- |
| Row | Title: the recipe name. Sub-line "Deleted by {name} · {n} days ago · {n} days left" ("today" on the day; "1 day ago"; "Last day" on the 30th; "Former member" once that person left). Trailing olive link "Restore" (screen reader: "Restore {name}"). |
| "Restore" | Puts it back as it was, for everyone. StatusBanner "“{name}” is back in your recipes." |
| Tap a row | BottomSheet titled with the recipe name: olive "Restore", danger link "Delete now". |
| "Delete now" | Dialog: "Delete “{name}” for good?" / "Its photos and variants go with it. This can't be undone." · "Delete now" · "Keep it" |
| Empty | "Nothing here." / "Recipes you delete stay here for 30 days." |
| Couldn't load | Callout "Couldn't load. Try again." + soft "Try again" |
| Restore failed / Delete now failed | StatusBanner "Couldn't restore. Try again." / "Couldn't delete. Try again." |
| Offline | Readable; "Restore" and the row's sheet are off (Patterns.md › Offline) |
