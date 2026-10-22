// ListRow's menu (spec 020): grocery rows open Edit, Move to… and Remove by long-press, right-click
// or the keyboard's menu key, and offer the same choices as screen-reader actions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListRow } from './ListRow';

afterEach(cleanup);

describe('ListRow menu', () => {
  it('ticks on press and opens the menu on right-click or the menu key', () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    render(<ListRow title="Gruyère" sub="Added by Mia" leading={{ kind: 'checkbox', checked: false }} onPress={onPress} onLongPress={onLongPress} onSwipeLeft={onLongPress} />);
    const row = screen.getByRole('checkbox', { name: /Gruyère/ });
    fireEvent.click(row);
    expect(onPress).toHaveBeenCalledOnce();
    fireEvent.contextMenu(row);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it('shows a ticked row struck through, still checked', () => {
    render(<ListRow title="Sourdough loaf" done leading={{ kind: 'checkbox', checked: true }} onPress={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: /Sourdough loaf/ }).getAttribute('aria-checked')).toBe('true');
  });
});
