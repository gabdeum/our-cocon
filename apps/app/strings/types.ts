import type { strings as en } from './en';

/** The shape of a translation: `en` with its words widened, so other languages fill the same keys. */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends (...args: infer A) => infer R
      ? (...args: A) => Widen<R>
      : { readonly [K in keyof T]: Widen<T[K]> };

export type Strings = Widen<typeof en>;
