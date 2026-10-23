/**
 * Amounts written as text don't change with the servings, so assistants must put them on an
 * ingredient row instead (spec 023 FR-004). An amount with a weight, volume or spoon unit counts;
 * one that holds whatever the servings ("2 tbsp per serving") or sizes a pan ("a 2 l pot") doesn't.
 */
const AMOUNT =
  /(?<![\p{L}\d])(?:\d+(?:[.,/]\d+)?\s?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])\s?(?:mg|g|kg|grams?|grammes?|kilos?|kilograms?|ml|cl|dl|l|litres?|liters?|millilit(?:re|er)s?|tsp|tbsp|teaspoons?|tablespoons?|spoons?|spoonfuls?|cups?|oz|ounces?|lbs?|pounds?)(?![\p{L}\d])/giu;
const FIXED = /^\s*(?:of\s+\S+\s+)?(?:per\s+(?:serving|person|portion|head|plate|bowl|glass)|each|(?:\S+\s+)?(?:pan|pot|saucepan|tin|dish|casserole|jar|bowl|mould|mold|tray|bottle|jug)s?\b)/iu;

/** The first amount in `text` that should scale with the servings, as written ("20 g"), or null. */
export function scalingAmountIn(text: string): string | null {
  for (const m of text.matchAll(AMOUNT)) {
    if (!FIXED.test(text.slice(m.index + m[0].length, m.index + m[0].length + 40))) return m[0].trim();
  }
  return null;
}
