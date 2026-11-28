import type { Unit } from '@cocon/schemas/recipes';
import { afterEach, describe, expect, it } from 'vitest';
import { displayWordsByLanguage, setDisplayWords } from './display';
import { format } from './format';
import type { FormatOptions, QuantityIngredient } from './types';

// Spec 076 FR-010: amounts in French and Spanish. Names are the recipe's own text, so they stay.

const metric: FormatOptions = { system: 'metric', scale: true };
const ing = (name: string, quantity: number | null, unit: Unit | null, extra: Partial<QuantityIngredient> = {}): QuantityIngredient => ({ id: name, name, quantity, unit, ...extra });

afterEach(() => setDisplayWords(displayWordsByLanguage.en));

describe('French', () => {
  it('writes "de", or "d’" before a vowel, and a decimal comma', () => {
    setDisplayWords(displayWordsByLanguage.fr);
    expect(format(ing('farine', 1500, 'g'), metric).phrase).toBe('1,5 kg de farine');
    expect(format(ing('huile d’olive', 2, 'tbsp'), metric).phrase).toBe('2 c. à s. d’huile d’olive');
    expect(format(ing('haricots', 200, 'g'), metric).phrase).toBe('200 g de haricots');
  });

  it('names a pinch and plural units', () => {
    setDisplayWords(displayWordsByLanguage.fr);
    expect(format(ing('sel', 1, 'pinch'), metric)).toMatchObject({ unit: 'pincée', phrase: '1 pincée de sel' });
    expect(format(ing('sel', 2, 'pinch'), metric)).toMatchObject({ unit: 'pincées' });
    expect(format(ing('lait', 2, 'cup'), { system: 'imperial', scale: true }).unit).toBe('tasses');
  });

  it('puts a size after the noun, so it needs no agreement', () => {
    setDisplayWords(displayWordsByLanguage.fr);
    expect(format(ing('œufs', 2, 'piece', { size_word: 'large', piece_noun_plural: 'œufs' }), metric).phrase).toBe('2 œufs (grand format)');
  });
});

describe('Spanish', () => {
  it('writes "de" and a decimal comma', () => {
    setDisplayWords(displayWordsByLanguage.es);
    expect(format(ing('harina', 1500, 'g'), metric).phrase).toBe('1,5 kg de harina');
    expect(format(ing('aceite', 2, 'tbsp'), metric).phrase).toBe('2 cdas de aceite');
    expect(format(ing('sal', 1, 'pinch'), metric).phrase).toBe('1 pizca de sal');
  });
});
