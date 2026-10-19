/** FR-003 rounding and how rounded numbers read. */

const EPSILON = 1e-9;

/** Nearest multiple of `step`, halves rounding up (1.25 to the nearest ½ is 1½). */
export function toStep(value: number, step: number): number {
  return Math.round(value / step + EPSILON) * step;
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** "1½", "¾", "2". Numbers that aren't a multiple of ¼ read as one decimal. */
export function fractionText(value: number): string {
  const quarters = Math.round(value * 4);
  if (Math.abs(quarters - value * 4) > 1e-6) return decimalText(value);
  const whole = Math.floor(quarters / 4);
  const fraction = FRACTIONS[(quarters % 4) / 4];
  if (!fraction) return String(whole);
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

/** One decimal, without a trailing ".0" ("0.7", "2.6", "1"). */
export function decimalText(value: number): string {
  return String(toStep(value, 0.1).toFixed(1)).replace(/\.0$/, '');
}
