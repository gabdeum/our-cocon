// Spec 013's components: AmountField, RadioCard, ResultTile, and Stepper's display.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AmountField } from './AmountField';
import { RadioCard } from './RadioCard';
import { ResultTile } from './ResultTile';
import { Stepper } from './Stepper';

afterEach(cleanup);

const labels: Record<string, string> = { g: 'g', kg: 'kg', ml: 'ml' };

describe('AmountField', () => {
  it('opens the unit list, picks a unit and closes', () => {
    const onUnit = vi.fn();
    render(<AmountField label="Convert" value="300" onChangeText={() => undefined} unit="g" units={['g', 'kg']} onUnitChange={onUnit} unitLabel={(u) => labels[u] ?? u} unitA11y="Unit" />);
    const button = screen.getByRole('button', { name: 'Unit: g' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(screen.getByRole('radio', { name: 'g' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'kg' }));
    expect(onUnit).toHaveBeenCalledWith('kg');
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('with one unit, the unit button has no menu', () => {
    render(<AmountField label="Convert" value="" onChangeText={() => undefined} unit="ml" units={['ml']} onUnitChange={() => undefined} unitLabel={(u) => u} unitA11y="Unit" hint="Enter how much you have" />);
    expect(screen.getByRole('button', { name: 'Unit: ml' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Enter how much you have')).toBeTruthy();
  });

  it('reports typing', () => {
    const onText = vi.fn();
    render(<AmountField label="Convert" value="" onChangeText={onText} unit="ml" units={['ml']} onUnitChange={() => undefined} unitLabel={(u) => u} unitA11y="Unit" />);
    fireEvent.change(screen.getByLabelText('Convert'), { target: { value: '250' } });
    expect(onText).toHaveBeenCalledWith('250');
  });
});

describe('RadioCard', () => {
  it('is a radio with its value in its name', () => {
    const onPress = vi.fn();
    render(<RadioCard label="Bacon lardons" value="200 g" selected={false} onPress={onPress} />);
    const radio = screen.getByRole('radio', { name: 'Bacon lardons, 200 g' });
    expect(radio.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(radio);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('ResultTile', () => {
  it('reads as one phrase', () => {
    render(<ResultTile value="1¼" label="cups" main />);
    expect(screen.getByLabelText('1¼ cups')).toBeTruthy();
  });
});

describe('Stepper display', () => {
  it('shows the display text instead of the value', () => {
    render(<Stepper value={7} display="7½" onChange={() => undefined} decreaseLabel="Fewer servings" increaseLabel="More servings" />);
    expect(screen.getByText('7½')).toBeTruthy();
  });
});
