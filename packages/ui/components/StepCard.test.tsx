// TimerRow (StepCard README): what screen readers get. The clock never talks on its own;
// the announcement is said once, politely (OC-RecipeSteps › Accessibility labels).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { stepWords, TimerRow, type TimerRowProps } from './StepCard';

afterEach(cleanup);

const row = (props: Partial<TimerRowProps> = {}) => {
  const p: TimerRowProps = {
    state: 'running',
    label: 'Pause',
    clock: '01:00',
    onPress: vi.fn(),
    minusLabel: '−1',
    plusLabel: '+1',
    minusA11y: 'One minute less',
    plusA11y: 'One minute more',
    onMinus: vi.fn(),
    onPlus: vi.fn(),
    ...props,
  };
  render(<TimerRow {...p} />);
  return p;
};

describe('TimerRow', () => {
  it('keeps the clock silent and puts the announcement in a polite live region', () => {
    row({ announcement: '1 minute left' });
    expect(screen.getByText('01:00').getAttribute('aria-live')).toBe('off');
    const live = screen.getByText('1 minute left');
    expect(live.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it('works: the button and −1 / +1 call back, and the button reads as pressed while running', () => {
    const p = row();
    const button = screen.getByRole('button', { name: /Pause/ });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'One minute less' }));
    fireEvent.click(screen.getByRole('button', { name: 'One minute more' }));
    expect(p.onPress).toHaveBeenCalledTimes(1);
    expect(p.onMinus).toHaveBeenCalledTimes(1);
    expect(p.onPlus).toHaveBeenCalledTimes(1);
  });
});

// The iPhone lays step text out word by word so an amount's highlight is rounded and stops where its text does.
describe('stepWords', () => {
  const words = stepWords(['Add ', { amount: '200 g onion' }, ', then ', { missing: 'leek' }, '.']);
  const text = (w: { text: string }[]) => w.map((r) => r.text).join('');

  it('splits at spaces, each word keeping its space, and keeps punctuation with its word', () => {
    expect(words.map(text)).toEqual(['Add ', '200 ', 'g ', 'onion, ', 'then ', 'leek.']);
  });

  it("highlights the spaces inside an amount, not the one after it, and rounds only the amount's ends", () => {
    expect(words[1]).toEqual([{ text: '200', kind: 'amount', first: true, last: false }, { text: ' ', kind: 'amount' }]);
    expect(words[2]).toEqual([{ text: 'g', kind: 'amount', first: false, last: false }, { text: ' ', kind: 'amount' }]);
    expect(words[3]).toEqual([{ text: 'onion', kind: 'amount', first: false, last: true }, { text: ',', kind: 'plain' }, { text: ' ', kind: 'plain' }]);
    expect(words[5]).toEqual([{ text: 'leek', kind: 'missing' }, { text: '.', kind: 'plain' }]);
  });
});
