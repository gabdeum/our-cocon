// Spec 066: the step list beside cooking mode from 960, and a step's photo seen full screen.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CookStepList } from './CookStepList';
import { PhotoViewer, StepPhoto } from './PhotoViewer';
import { TimePresets } from './TimePresets';

afterEach(cleanup);

const steps = [
  { name: 'Preheat and line', time: null, label: 'Go to step 1: Preheat and line' },
  { name: 'Blind bake', time: '11:42', label: 'Go to step 2: Blind bake, timer 11:42' },
  { name: null, time: null, label: 'Go to step 3' },
];

describe('CookStepList', () => {
  it('lists every step, marks the current one, ticks the done ones and goes to the tapped one', () => {
    const onSelect = vi.fn();
    render(<CookStepList title="All steps" steps={steps} current={1} onSelect={onSelect} numbered={(n) => `Step ${n}`} />);
    const list = screen.getByRole('navigation', { name: 'All steps' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(steps.map((s) => s.label));
    expect(rows.map((r) => r.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    // Done: a tick, no number; current and to do: the number. Unnamed: "Step 3".
    expect(rows[0]?.textContent).toBe('Preheat and line');
    expect(rows[1]?.textContent).toBe('2Blind bake11:42');
    expect(rows[2]?.textContent).toBe('3Step 3');
    fireEvent.click(rows[2] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe('PhotoViewer', () => {
  it('a step photo opens full screen; ✕ closes it', () => {
    const onPress = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<StepPhoto source={{ uri: 'https://photos.test/a.jpg' }} size={96} label="See the photo for Bake larger" onPress={onPress} />);
    const thumb = screen.getByRole('button', { name: 'See the photo for Bake larger' });
    expect(thumb.style.width).toBe('96px');
    fireEvent.click(thumb);
    expect(onPress).toHaveBeenCalled();
    rerender(<PhotoViewer source={{ uri: 'https://photos.test/a.jpg' }} label="Photo for Bake" closeLabel="Close photo" onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Photo for Bake' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close photo' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows nothing while closed', () => {
    render(<PhotoViewer source={null} label="Photo for Bake" closeLabel="Close photo" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TimePresets eyebrow', () => {
  it('keeps the group name and one button per time', () => {
    render(<TimePresets label="Quick timer" eyebrow presets={[5, 10].map((m) => ({ label: `${m} min`, a11y: `Start a ${m} min kitchen timer`, onPress: vi.fn() }))} />);
    const group = screen.getByRole('group', { name: 'Quick timer' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Start a 5 min kitchen timer', 'Start a 10 min kitchen timer']);
  });
});
