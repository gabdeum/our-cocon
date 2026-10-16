// States of the interactive components (spec 002, FR-002). Visuals are checked in /dev/gallery;
// these check behaviour and what screen readers get.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Button } from './Button';
import { Switch, SettingRow } from './Switch';
import { SegmentedControl } from './SegmentedControl';
import { Stepper } from './Stepper';
import { Pill, Choice } from './Pill';
import { TextField } from './TextField';
import { IconButton } from './IconButton';
import { MonthPicker } from './MonthPicker';
import { AvatarStack, avatarTone } from './Avatar';

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
  it('assigns tones honey, sage, peach, then repeats', () => {
    expect([0, 1, 2, 3].map(avatarTone)).toEqual(['honey', 'sage', 'peach', 'honey']);
  });

  it('stacks up to 4, then "+N"', () => {
    const members = 'ABCDEF'.split('').map((initial, i) => ({ initial, tone: avatarTone(i) }));
    render(<AvatarStack members={members} moreLabel={(n) => `+${n}`} label="Family" />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByText('E')).toBeNull();
  });
});
