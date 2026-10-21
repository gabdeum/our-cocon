import { temperatureToken } from './render-step';
import { fToC } from './units';

/**
 * A temperature as people type it in a step: a number, then a degree sign and C or F ("180 °C",
 * "350°F", "180 ° c"), or C or F straight after a number of two digits or more ("180C"). "2 C"
 * stays text: it could be cups. A letter right after it ("180Cal") doesn't count.
 */
const TYPED = /(?<![\p{L}\d.,])(\d{1,3}(?:[.,]\d)?)(?:\s?[°º]\s?([CcFf])|([CF]))(?![\p{L}\d])/gu;

/** Ingredient and temperature tokens, which are left as they are. */
const TOKEN = /\{[^{}]*\}/g;

/** The lowest and highest °C a step can mention (the database checks the same for temperature checks). */
const MIN_C = -50;
const MAX_C = 400;

/**
 * Spec 016 FR-006: temperatures typed in a step's text become `{temp:<°C>}` tokens (°F turned to
 * °C), so every reader sees both scales. They're oven temperatures; the form marks a thermometer
 * reading itself. Text inside existing tokens is never touched.
 */
export function tokenizeTemperatures(body: string): string {
  let out = '';
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    out += tokenizeText(body.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + tokenizeText(body.slice(last));
}

function tokenizeText(text: string): string {
  return text.replace(TYPED, (whole, value: string, afterDegree?: string, attached?: string) => {
    // "9F" is more likely a label than a temperature: attached letters need two digits.
    if (attached && value.length < 2) return whole;
    const scale = (afterDegree ?? attached ?? '').toUpperCase();
    const n = Number(value.replace(',', '.'));
    const celsius = scale === 'F' ? fToC(n) : n;
    if (!Number.isFinite(celsius) || celsius < MIN_C || celsius > MAX_C) return whole;
    return temperatureToken(celsius);
  });
}
