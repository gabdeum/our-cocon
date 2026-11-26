// TimerRow (StepCard README): what screen readers get. The clock never talks on its own;
// "1 minute left" and "done" come from the timer store (spec 030 FR-002).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StepRow, stepWords, TimerRow, type TimerRowProps } from './StepCard';

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
  it('keeps the clock silent', () => {
    row();
    expect(screen.getByText('01:00').getAttribute('aria-live')).toBe('off');
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

// Spec 067 FR-004: the step card on the recipe page, at every size.
describe('StepRow', () => {
  it('shows the number, name, Variant tag, timer length and photo; the whole card opens the step', () => {
    const onPress = vi.fn();
    render(<StepRow number={1} title="Make the dough" tag="Variant" duration="30 min" photoUri="https://example.test/dough.jpg" accessibilityLabel="Step 1: Make the dough, Variant, 30 min timer. Opens in cooking mode" onPress={onPress} />);
    const card = screen.getByRole('link', { name: 'Step 1: Make the dough, Variant, 30 min timer. Opens in cooking mode' });
    expect(card.textContent).toBe('1Make the doughVariant30 min');
    expect(card.querySelector('img')).toBeTruthy();
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalled();
  });

  it('leaves out what a step does not have', () => {
    render(<StepRow number={4} title="Mix the custard" accessibilityLabel="Step 4: Mix the custard. Opens in cooking mode" onPress={vi.fn()} />);
    expect(screen.getByRole('link').textContent).toBe('4Mix the custard');
    expect(screen.queryByTestId('step-row-timer')).toBeNull();
  });

  it('wraps a long name, and cuts a step text standing in for one after 2 lines', () => {
    const name = 'Fold the egg whites into the chocolate in three goes, gently, keeping the air in';
    const { unmount } = render(<StepRow number={2} title={name} accessibilityLabel={`Step 2: ${name}`} onPress={vi.fn()} />);
    expect(screen.getByText(name).outerHTML).not.toMatch(/line-clamp|ellipsis|nowrap/i);
    unmount();
    render(<StepRow number={2} title={name} titleLines={2} accessibilityLabel={`Step 2: ${name}`} onPress={vi.fn()} />);
    expect(screen.getByText(name).outerHTML).toMatch(/line-clamp/i);
  });
});
