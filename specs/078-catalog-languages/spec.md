# 078 — The ingredient catalog in French and Spanish

**Status:** Ready to build
**Depends on:** 031 (catalog), 076 (languages)
**Updates:** 031 FR-008 (names in English only), 015 FR-003 (paste parser English only), README decisions 15 and 30

## Summary
All catalog ingredients get French and Spanish names, plurals, synonyms, piece nouns and pack labels. Typing or pasting "oignons" or "cebollas" matches the onion, suggestions show names in the person's language, and new items are saved with the name in the adder's language. Text already saved is never rewritten.

## Functional requirements
- **FR-001** `data/catalog/ingredients.json`: `names`, `synonyms`, piece nouns and pack labels per language (en, fr, es) for every item.
- **FR-002** Normalising (`packages/schemas/ingredient-text.ts`) handles French and Spanish: accents folded, descriptors ("haché", "émincé", "picado"…), linking words ("de", "d'", "du", "del"…) and plurals.
- **FR-003** `catalog_names.lang` accepts en, fr and es. Matching and suggestions look in every language and rank the person's language first; facts return names in the requested language (English by default, which the MCP server keeps).
- **FR-004** Suggestions and new grocery items and recipe ingredients use the catalog name in the adder's language. Saved text stays as it was.
- **FR-005** The paste parser reads French and Spanish lines ("2 c. à soupe d'huile d'olive", "1 cucharada de aceite"): units, number words and linking words per language, trying the person's language first, then English.

## Success criteria
- **SC-001** In French, typing "oignons" in groceries suggests "Oignon" in Fruits et légumes.
- **SC-002** Pasting "2 c. à soupe d'huile d'olive" reads as 2 tbsp of olive oil, matched to the catalog.
- **SC-003** Every catalog item has a French and a Spanish name (a test checks it).

## Tracking (PostHog)
No new events. Existing match events gain no user text.

## Warnings and errors
- No new messages.

## Needs your attention (defaults chosen)
- Matching looks in all three languages for everyone, so a mixed-language family's lists still match.

## Changelog
- 2026-11-28 — First version.
