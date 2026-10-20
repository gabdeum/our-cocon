// Spec 013 US2 (scale by an ingredient), FR-003 and the edge cases (design/ui/OC-ScaleIng.md).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { quicheIds } from '@cocon/schemas/quiche.fixture';
import { ScaleSheet } from './ScaleSheet';
import { defaultPanelChoices, type RecipeChoices } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { quicheDetail } from '../../test/quiche-detail';

afterEach(cleanup);

const choices: RecipeChoices = { servings: 6, version: null, options: [], ...defaultPanelChoices, scaledBy: null };

function setup(extra: Partial<RecipeChoices> = {}) {
  const tracker = fakeTracker();
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<ScaleSheet recipe={quicheDetail} choices={{ ...choices, ...extra }} tracker={tracker} onApply={onApply} onClose={onClose} />);
  return { tracker, onApply, onClose };
}
const radio = (name: RegExp) => screen.getByRole('radio', { name });
const apply = () => screen.getByRole('button', { name: 'Apply to recipe' });
const type = (text: string) => fireEvent.change(screen.getByLabelText('2. How much do you have?'), { target: { value: text } });

describe('Scale by an ingredient', () => {
  it('FR-003: 3 ingredients, then "Show all 7 ingredients" (no pinch)', () => {
    setup();
    expect(screen.getByText('Scale by an ingredient')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 ingredients' }));
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    expect(screen.queryByRole('radio', { name: /Nutmeg/ })).toBeNull();
  });

  it('US2: Bacon lardons, 250 g → Recipe × 1.25 → about 7½ servings, eggs rounded; Apply', () => {
    const { tracker, onApply } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 ingredients' }));
    fireEvent.click(radio(/^Bacon lardons/));
    expect(radio(/^Bacon lardons/).getAttribute('aria-checked')).toBe('true');
    type('250');
    expect(screen.getByText('Recipe × 1.25 → about 7½ servings')).toBeTruthy();
    expect(screen.getByText(/Leeks 2½ \(375 g\)/)).toBeTruthy();
    expect(screen.getByText('Eggs are rounded to whole numbers. Cooking times stay the same.')).toBeTruthy();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith({ ingredientId: quicheIds.lardons, amount: 250, unit: 'g' });
    expect(tracker.track).toHaveBeenCalledWith('scaled_by_ingredient', {});
  });

  it('edge: empty or 0 disables Apply with "Enter how much you have"', () => {
    const { onApply } = setup();
    expect(screen.getByText('Enter how much you have')).toBeTruthy();
    expect(apply().getAttribute('aria-disabled')).toBe('true');
    type('0');
    expect(apply().getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByText(/Recipe ×/)).toBeNull();
    fireEvent.click(apply());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('edge: lardons only offer weights; leeks also count pieces', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 ingredients' }));
    fireEvent.click(radio(/^Bacon lardons/));
    fireEvent.click(screen.getByRole('button', { name: 'Unit: g' }));
    expect(screen.getAllByRole('radio', { name: /^(g|kg|oz|lb)$/ })).toHaveLength(4);
    expect(screen.queryByRole('radio', { name: 'ml' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    fireEvent.click(radio(/^Leeks/));
    expect(screen.getByRole('button', { name: 'Unit: pieces' })).toBeTruthy();
  });

  it('a big change warns; 1,5 is read as 1.5', () => {
    setup();
    fireEvent.click(radio(/^Leeks/));
    type('20');
    expect(screen.getByText("That's a big change. Check cooking times.")).toBeTruthy();
    type('1,5');
    expect(screen.getByText('Recipe × 0.75 → about 4½ servings')).toBeTruthy();
  });

  it('opens on what was applied before; Cancel closes without changes', () => {
    const { onClose, onApply } = setup({ scaledBy: { ingredientId: quicheIds.lardons, amount: 250, unit: 'g' } });
    expect(radio(/^Bacon lardons/).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Recipe × 1.25 → about 7½ servings')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
