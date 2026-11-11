// Spec 030 User Story 3: at the largest system text sizes month cells fall back to their first chip
// and dots, and the cell's label still names every event.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MonthGrid, type MonthWeek } from './MonthGrid';

const dims = vi.hoisted(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => dims }));

afterEach(() => {
  cleanup();
  dims.fontScale = 1;
});

const week = (): MonthWeek => ({
  key: 'w0',
  cells: Array.from({ length: 7 }, (_, d) => ({
    date: `2026-10-0${d + 1}`,
    label: d === 3 ? 'October 4: Brunch (Eva), Baby swim (James), Movie night (Everyone)' : `October ${d + 1}: nothing planned`,
    dateText: String(d + 1),
    first: false,
    today: false,
    past: false,
    items:
      d === 3
        ? [
            { kind: 'chip', key: 'a', text: 'Brunch', colors: ['rose'] },
            { kind: 'chip', key: 'b', text: 'Baby swim', colors: ['sky'] },
            { kind: 'chip', key: 'c', text: 'Movie night', colors: ['everyone'] },
          ]
        : [],
    more: null,
  })),
  bars: [],
});

const grid = () =>
  render(<MonthGrid weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']} weekCount={1} weekAt={week} initialIndex={0} onTopRowChange={vi.fn()} onDayPress={vi.fn()} onDayLongPress={vi.fn()} addLabel="Add event" />);

describe('month cells at large text sizes', () => {
  it('show every chip at the usual size', () => {
    grid();
    expect(['Brunch', 'Baby swim', 'Movie night'].map((t) => screen.queryByText(t) !== null)).toEqual([true, true, true]);
  });

  it('show the first chip, then dots, and still name every event to screen readers', () => {
    dims.fontScale = 2;
    grid();
    expect(['Brunch', 'Baby swim', 'Movie night'].map((t) => screen.queryByText(t) !== null)).toEqual([true, false, false]);
    expect(screen.getByRole('button', { name: 'October 4: Brunch (Eva), Baby swim (James), Movie night (Everyone)' })).toBeTruthy();
  });
});
