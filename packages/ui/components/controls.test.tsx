// States of the interactive components (spec 002, FR-002). Visuals are checked in /dev/gallery;
// these check behaviour and what screen readers get.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Button, labelFits } from './Button';
import { Switch, SettingRow } from './Switch';
import { SegmentedControl } from './SegmentedControl';
import { Stepper } from './Stepper';
import { Pill, Choice } from './Pill';
import { TextField } from './TextField';
import { IconButton } from './IconButton';
import { MonthPicker } from './MonthPicker';
import { AvatarStack, type MemberColor } from './Avatar';
import { ColorSwatch } from './ColorSwatch';

afterEach(cleanup);

describe('Button', () => {
  it('is disabled and does nothing when disabled', () => {
    const onPress = vi.fn();
    render(<Button label="Nothing selected" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Nothing selected' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps its place and shows the busy label while busy', () => {
    render(<Button label="Save recipe" busy busyLabel="Saving…" />);
    expect(screen.getByRole('button', { name: 'Saving…' }).getAttribute('aria-busy')).toBe('true');
  });
});

describe('Switch', () => {
  it('is a switch that reports and flips its state', () => {
    const onChange = vi.fn();
    render(<Switch label="Show cups" value={false} onValueChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Show cups' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from anywhere on its setting row', () => {
    function Row() {
      const [on, setOn] = useState(true);
      return <SettingRow label="Temperature checks" hint="Off: hides temperature checks in steps" value={on} onValueChange={setOn} />;
    }
    render(<Row />);
    fireEvent.click(screen.getByText('Off: hides temperature checks in steps'));
    expect(screen.getByRole('switch', { name: 'Temperature checks' }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('SegmentedControl', () => {
  const segments = [
    { key: 'metric', label: 'Metric' },
    { key: 'imperial', label: 'Imperial' },
  ] as const;

  it('marks the selected option pressed', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Units" segments={[...segments]} value="metric" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Metric' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    expect(onChange).toHaveBeenCalledWith('imperial');
  });

  it('uses tab semantics for the dark tabs', () => {
    render(<SegmentedControl variant="tabs" label="Recipe" segments={[{ key: 'i', label: 'Ingredients · 9' }, { key: 's', label: 'Steps · 6' }]} value="s" onChange={() => undefined} />);
    expect(screen.getByRole('tab', { name: 'Steps · 6' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tablist', { name: 'Recipe' })).toBeTruthy();
  });
});

describe('Stepper', () => {
  it('stays visible but does nothing at a limit, announced as dimmed', () => {
    const onChange = vi.fn();
    render(<Stepper value={1} onChange={onChange} decreaseLabel="Fewer servings" increaseLabel="More servings" />);
    const minus = screen.getByRole('button', { name: 'Fewer servings' });
    expect(minus.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(minus);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('stops at 16 servings', () => {
    const onChange = vi.fn();
    render(<Stepper value={16} onChange={onChange} decreaseLabel="Fewer servings" increaseLabel="More servings" />);
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Pill and Choice', () => {
  it('expose selection as pressed', () => {
    render(
      <>
        <Pill label="Quick" selected />
        <Choice label="Classic" selected={false} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Quick' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('IconButton', () => {
  it('always has a label, and the square one reports whether its panel is open', () => {
    render(<IconButton icon="more" label="More options" variant="square" expanded />);
    expect(screen.getByRole('button', { name: 'More options' }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('TextField', () => {
  it('warns without blocking typing and links the message to the input', () => {
    const onChange = vi.fn();
    render(<TextField label="Unit" warning="Pick a unit so we can convert and scale it." onChangeText={onChange} />);
    const input = screen.getByLabelText('Unit');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: 'g' } });
    expect(onChange).toHaveBeenCalledWith('g');
    expect(screen.getByText('Pick a unit so we can convert and scale it.')).toBeTruthy();
  });
});

describe('MonthPicker', () => {
  it('toggles months, keeping them in order', () => {
    const onChange = vi.fn();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    render(<MonthPicker label="Best months" monthLabels={months} value={[9]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Oct' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Mar' }));
    expect(onChange).toHaveBeenCalledWith([2, 9]);
  });
});

describe('Avatar', () => {
  it('stacks up to 4, then "+N"', () => {
    const colors: MemberColor[] = ['honey', 'rose', 'sky', 'mint', 'lilac', 'peach'];
    const members = 'ABCDEF'.split('').map((initial, i) => ({ initial, color: colors[i] ?? 'honey' }));
    render(<AvatarStack members={members} moreLabel={(n) => `+${n}`} label="Family" />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByText('E')).toBeNull();
  });
});

describe('Button › short label', () => {
  it('a label fits when it is no wider than the button less its padding and icon', () => {
    // 170 wide, 24 padding each side, icon 20 + gap 10: 92 left for the label.
    expect(labelFits(170, 92, 24, true)).toBe(true);
    expect(labelFits(170, 93, 24, true)).toBe(false);
    expect(labelFits(170, 120, 24, false)).toBe(true);
    // Not measured yet: the full label shows.
    expect(labelFits(0, 120, 24, true)).toBe(true);
  });

  it('short shows the short label; screen readers still read the full one', () => {
    render(<Button label="Start cooking" shortLabel="Cook" short onPress={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Start cooking' });
    // The full label after it is the hidden one that measures it.
    expect(button.textContent?.startsWith('Cook')).toBe(true);
  });

  it('without short, the full label shows', () => {
    render(<Button label="Start cooking" shortLabel="Cook" onPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Start cooking' }).textContent?.startsWith('Start cooking')).toBe(true);
  });
});

describe('ColorSwatch', () => {
  const options = [
    { color: 'honey', state: 'selected', initial: 'G', accessibilityLabel: 'Honey, your color' },
    { color: 'rose', state: 'taken', initial: 'E', accessibilityLabel: 'Rose, taken' },
    { color: 'sky', state: 'free', accessibilityLabel: 'Sky, free' },
  ] as const;

  it('names each swatch with its state, and shows who has the taken ones', () => {
    render(<ColorSwatch label="My color" options={options} onSelect={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'My color' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Honey, your color' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('E')).toBeTruthy();
  });

  it("can't pick a taken color", () => {
    const onSelect = vi.fn();
    render(<ColorSwatch label="My color" options={options} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Rose, taken' }));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Sky, free' }));
    expect(onSelect).toHaveBeenCalledWith('sky');
  });
});
