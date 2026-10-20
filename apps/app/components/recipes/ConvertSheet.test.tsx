// Spec 013 US3 (quick conversion), FR-004/005 (design/ui/OC-Units.md).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResultTileProps } from '@cocon/ui';

// Watches which tile is the main (honey) one; styles don't apply under jsdom.
const tiles = vi.hoisted(() => ({ seen: [] as { label: string; main: boolean }[] }));
vi.mock('@cocon/ui', async (load) => {
  const ui = await load<typeof import('@cocon/ui')>();
  return {
    ...ui,
    ResultTile: (props: ResultTileProps) => {
      tiles.seen.push({ label: `${props.value} ${props.label}`, main: !!props.main });
      return ui.ResultTile(props);
    },
  };
});

const { ConvertSheet, CONVERT_SETTLE_MS } = await import('./ConvertSheet');
import { defaultPanelChoices, type RecipeChoices } from '../../lib/recipe-choices';
import { fakeTracker } from '../../test/fakes';
import { quicheDetail } from '../../test/quiche-detail';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const choices: RecipeChoices = { servings: 6, version: null, options: [], ...defaultPanelChoices, scaledBy: null };

function setup() {
  const tracker = fakeTracker();
  const onClose = vi.fn();
  render(<ConvertSheet recipe={quicheDetail} choices={choices} tracker={tracker} onClose={onClose} />);
  return { tracker, onClose };
}
const type = (text: string) => fireEvent.change(screen.getByLabelText('Convert'), { target: { value: text } });

describe('Unit converter', () => {
  it('US3: Volume, 300 ml → 1¼ cups, 20 tbsp, 61 tsp, 10.1 fl oz, and the heavy cream note', () => {
    const { tracker } = setup();
    expect(screen.getByRole('button', { name: 'Volume' }).getAttribute('aria-pressed')).toBe('true');
    type('300');
    for (const tile of ['1¼ cups', '20 tablespoons', '61 teaspoons', '10.1 fl oz (US)']) expect(screen.getByLabelText(tile)).toBeTruthy();
    // Only the first tile is the main (honey) one.
    expect(tiles.seen.slice(-4)).toEqual([
      { label: '1¼ cups', main: true },
      { label: '20 tablespoons', main: false },
      { label: '61 teaspoons', main: false },
      { label: '10.1 fl oz (US)', main: false },
    ]);
    expect(screen.getByText('For this recipe')).toBeTruthy();
    expect(screen.getByText("300 ml heavy cream weighs about 300 g. Handy if you'd rather weigh it on your scale.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CONVERT_SETTLE_MS));
    expect(tracker.track).toHaveBeenCalledWith('unit_converter_used', { from_unit: 'ml', to_unit: 'cup' });
  });

  it('Oven temp: 180 °C → 350 °F, gas mark 4, fan 160 °C; no recipe note', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Oven temp' }));
    expect(screen.getByRole('button', { name: 'Unit: °C' })).toBeTruthy();
    type('180');
    for (const tile of ['350 °F', '4 gas mark', '160 °C fan oven']) expect(screen.getByLabelText(tile)).toBeTruthy();
    expect(screen.queryByText('For this recipe')).toBeNull();
  });

  it('the unit list follows the tab; nothing shows without a number', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: ml' }));
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['ml', 'L', 'tsp', 'tbsp', 'cup', 'fl oz']);
    fireEvent.click(screen.getByRole('radio', { name: 'cup' }));
    type('');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('Cups and spoons use US measures. You can change this in Settings.')).toBeTruthy();
  });

  it('Close closes', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
