// IngredientEditCard and ReorderList (spec 015): the card's warning state, and where a dragged row
// lands, plus the keyboard way to move one.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PanResponder, type GestureResponderEvent, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';
import { IngredientEditCard } from './IngredientEditCard';
import { dropIndex, ReorderList } from './ReorderList';

afterEach(cleanup);

const base = {
  name: 'Heavy cream',
  onNameChange: vi.fn(),
  nameLabel: 'Ingredient name',
  quantity: '300',
  onQuantityChange: vi.fn(),
  quantityLabel: 'Quantity',
  unitPlaceholder: 'Unit?',
  unitLabel: 'Unit',
  onUnitPress: vi.fn(),
  removeLabel: 'Remove Heavy cream',
  onRemove: vi.fn(),
};

describe('IngredientEditCard', () => {
  it('warns on the unit and says what to do', () => {
    render(<IngredientEditCard {...base} unit={null} warning="Pick a unit so we can convert and scale it." warningField="unit" />);
    expect(screen.getByRole('alert').textContent).toBe('Pick a unit so we can convert and scale it.');
    const unit = screen.getByRole('button', { name: 'Unit: Unit?' });
    expect(unit.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the weight of one for pieces', () => {
    const onChange = vi.fn();
    render(<IngredientEditCard {...base} name="Leeks" unit="pieces" weight={{ value: '150', onChange, label: 'Weight of one (g)', prefix: 'each ≈', suffix: 'g' }} />);
    const weight = screen.getByLabelText('Weight of one (g)') as HTMLInputElement;
    expect(weight.value).toBe('150');
    fireEvent.change(weight, { target: { value: '160' } });
    expect(onChange).toHaveBeenCalledWith('160');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes with its labelled button', () => {
    const onRemove = vi.fn();
    render(<IngredientEditCard {...base} unit="ml" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Heavy cream' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('ReorderList', () => {
  const tops = [0, 110, 220];
  const heights = [100, 100, 100];

  it('drops a row after every middle it passed', () => {
    expect(dropIndex(0, 0, tops, heights)).toBe(0);
    expect(dropIndex(0, 120, tops, heights)).toBe(1);
    expect(dropIndex(0, 230, tops, heights)).toBe(2);
    expect(dropIndex(2, -120, tops, heights)).toBe(1);
    expect(dropIndex(2, -300, tops, heights)).toBe(0);
  });

  it('moves a row with the arrow keys on its handle', () => {
    const onMove = vi.fn();
    render(
      <ReorderList
        items={['a', 'b', 'c']}
        keyOf={(i) => i}
        renderItem={(item, _i, handle) => (
          <>
            {handle}
            {item}
          </>
        )}
        onMove={onMove}
        handleLabel="Drag to reorder"
        moveUpLabel="Move up"
        moveDownLabel="Move down"
      />,
    );
    const handles = screen.getAllByRole('button', { name: 'Drag to reorder' });
    fireEvent.keyDown(handles[1] as HTMLElement, { key: 'ArrowUp' });
    expect(onMove).toHaveBeenCalledWith(1, 0);
    fireEvent.keyDown(handles[0] as HTMLElement, { key: 'ArrowUp' });
    expect(onMove).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handles[2] as HTMLElement, { key: 'ArrowDown' });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('a dragged row lands where it was let go', () => {
    // React Native resets the gesture state once a handler returns, before React applies the
    // update: the distance must be read in the handler (found testing 016: drops didn't move).
    const configs: PanResponderCallbacks[] = [];
    const create = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
    });
    const onMove = vi.fn();
    render(
      <ReorderList
        items={['a', 'b', 'c']}
        keyOf={(i) => i}
        renderItem={(item, _i, handle) => (
          <>
            {handle}
            {item}
          </>
        )}
        onMove={onMove}
        handleLabel="Drag to reorder"
        moveUpLabel="Move up"
        moveDownLabel="Move down"
      />,
    );
    // jsdom has no layout: give each row its place (90 tall, 100 apart) through the handler
    // react-native-web keeps on the element for onLayout.
    act(() => {
      screen.getAllByRole('button', { name: 'Drag to reorder' }).forEach((handle, i) => {
        const row = handle.parentElement as (HTMLElement & { __reactLayoutHandler?: (e: unknown) => void }) | null;
        row?.__reactLayoutHandler?.({ nativeEvent: { layout: { x: 0, y: i * 100, width: 300, height: 90 } } });
      });
    });
    const first = configs[0];
    if (!first) throw new Error('no responder');
    const e = {} as GestureResponderEvent;
    const g = { dy: 0 } as PanResponderGestureState;
    act(() => first.onPanResponderGrant?.(e, g));
    act(() => {
      g.dy = 300;
      first.onPanResponderMove?.(e, g);
    });
    act(() => {
      first.onPanResponderRelease?.(e, g);
      g.dy = 0;
    });
    expect(onMove).toHaveBeenCalledWith(0, 2);
    create.mockRestore();
  });
});
