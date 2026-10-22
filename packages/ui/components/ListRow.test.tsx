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

describe('ListRow title detail and action (spec 021)', () => {
  it('reads the amount beside the name, with the note after it', () => {
    render(<ListRow title="Heavy cream" titleDetail={{ text: '1 pint carton', note: '(need 300 ml)' }} leading={{ kind: 'checkbox', checked: false }} onPress={() => undefined} />);
    expect(screen.getByText(/^Heavy cream/).textContent).toBe('Heavy cream: 1 pint carton (need 300 ml)');
  });

  it('has an action beside the row that never ticks it, and can be off', () => {
    const onPress = vi.fn();
    const onEdit = vi.fn();
    const { rerender } = render(
      <ListRow title="Gruyère" leading={{ kind: 'checkbox', checked: false }} onPress={onPress} action={{ icon: 'more-vertical', accessibilityLabel: 'Edit Gruyère', onPress: onEdit }} />,
    );
    const edit = screen.getByRole('button', { name: 'Edit Gruyère' });
    expect(screen.getByRole('checkbox', { name: /Gruyère/ }).contains(edit)).toBe(false);
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();
    rerender(<ListRow title="Gruyère" leading={{ kind: 'checkbox', checked: false }} onPress={onPress} action={{ icon: 'more-vertical', accessibilityLabel: 'Edit Gruyère', onPress: onEdit, disabled: true }} />);
    expect(screen.getByRole('button', { name: 'Edit Gruyère' }).getAttribute('aria-disabled')).toBe('true');
  });
});
