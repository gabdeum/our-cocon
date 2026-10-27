# OC-SettingsGroceries — Groceries settings

Source `screens/OC-SettingsGroceries.dc.html` · Route `/settings/groceries` · Specs 021, 029

## Layout
1. Back link "Menu"; title "Groceries"; lead "For the whole family. You can also change these from the Groceries tab."
2. **Where do you shop?** card: SegmentedControl "US" | "Europe"; example below (14/600 ink-muted): "Recipe needs 300 ml cream → Buy 1 pint" (US) / "→ Buy 2 × 20 cl" (Europe) — same fixed copy as the Grocery settings sheet.
3. Card with switch "Round up to store sizes" / "Off: shows only what recipes need".

## Behaviour
Same family settings (`store_profile`, `round_to_packs`) as the Groceries tab's "Grocery settings" sheet (spec 021), which stays. Use the sheet's components and copy from `OC-Groceries.md` if they differ from this drawing; the page wraps them in white cards like the other settings pages.
