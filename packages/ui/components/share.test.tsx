// ShareTile and the compact IngredientRow (spec 019): the share sheet's tiles and the shared page's rows.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShareTile } from './ShareTile';
import { IngredientRow } from './ListRow';

afterEach(cleanup);

describe('ShareTile', () => {
  it('is a labelled button', () => {
    const onPress = vi.fn();
    render(<ShareTile label="Message" icon="message" tone="honey" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled', () => {
    const onPress = vi.fn();
    render(<ShareTile label="Email" icon="mail" disabled onPress={onPress} />);
    const tile = screen.getByRole('button', { name: 'Email' });
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tile);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IngredientRow compact', () => {
  it('puts the name first and "{amount} · {weight}" after it', () => {
    render(<IngredientRow layout="compact" amount="2" sub="300 g" name="Leeks" />);
    expect(screen.getByRole('listitem').textContent).toBe('Leeks2 · 300 g');
  });

  it('shows the amount alone when there is no weight', () => {
    render(<IngredientRow layout="compact" amount="300 ml" name="Heavy cream" />);
    expect(screen.getByText('300 ml')).toBeTruthy();
  });
});
