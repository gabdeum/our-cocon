/** Why a quantity can't be scaled, converted or shown. Callers show their screen's error copy. */
export type QuantityErrorCode = 'invalid_quantity' | 'incompatible_units' | 'unknown_ingredient';

export class QuantityError extends Error {
  override readonly name = 'QuantityError';

  constructor(
    readonly code: QuantityErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** A finite amount of zero or more; anything else throws `invalid_quantity`. */
export function assertAmount(value: number, what = 'Amount'): void {
  if (!Number.isFinite(value) || value < 0) throw new QuantityError('invalid_quantity', `${what} must be a number of zero or more, got ${value}`);
}
