/**
 * Amounts written as text don't change with the servings, so assistants must put them on an
 * ingredient row instead (spec 023 FR-004). An amount with a weight, volume or spoon unit counts;
 * one that holds whatever the servings doesn't: an amount for one of something ("2 tbsp per serving",
 * "75 g per bao ball", "75 g each", "75 g/bun"), a ratio ("12 g of onion per 100 g of flour", both
 * sides) or a pan's size ("a 2 l pot").
 */
const AMOUNT =
  /(?<![\p{L}\d])(?:\d+(?:[.,/]\d+)?\s?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])\s?(?:mg|g|kg|grams?|grammes?|kilos?|kilograms?|ml|cl|dl|l|litres?|liters?|millilit(?:re|er)s?|tsp|tbsp|teaspoons?|tablespoons?|spoons?|spoonfuls?|cups?|oz|ounces?|lbs?|pounds?)(?![\p{L}\d])/giu;
const FIXED = /^\s*(?:of\s+(?:\S+\s+){1,3})?(?:per\s+[\p{L}\d]|\/\s*[\p{L}\d]|each|apiece|a\s+piece|for\s+(?:each|every)\s|(?:\S+\s+)?(?:pan|pot|saucepan|tin|dish|casserole|jar|bowl|mould|mold|tray|bottle|jug)s?\b)/iu;

/** What a ratio's second amount follows: "per 100 g", "for every 100 g", "/100 g". */
const RATIO_BASE = /(?:\bper|\bevery|\beach|\/)\s*$/iu;

/** The first amount in `text` that should scale with the servings, as written ("20 g"), or null. */
export function scalingAmountIn(text: string): string | null {
  for (const m of text.matchAll(AMOUNT)) {
    if (RATIO_BASE.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (!FIXED.test(text.slice(m.index + m[0].length, m.index + m[0].length + 40))) return m[0].trim();
  }
  return null;
}
