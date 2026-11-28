import { en, type ParserWords } from './words.en';
import { es } from './words.es';
import { fr } from './words.fr';

/** Spec 078 FR-005: what people paste can be in any language the app speaks, so the parser reads all of them. */
export const parserWords: ParserWords = {
  units: { ...es.units, ...fr.units, ...en.units },
  countNouns: { ...es.countNouns, ...fr.countNouns, ...en.countNouns },
  sizes: { ...es.sizes, ...fr.sizes, ...en.sizes },
  one: [...new Set([...en.one, ...fr.one, ...es.one])],
  of: [...new Set([...en.of, ...fr.of, ...es.of])],
  prep: [...new Set([...en.prep, ...fr.prep, ...es.prep])],
  phrases: [...(fr.phrases ?? []), ...(es.phrases ?? [])],
  elided: [...(fr.elided ?? []), ...(es.elided ?? [])],
};
