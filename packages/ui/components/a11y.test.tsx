// Spec 030: what the accessibility pass adds to every component. Large text is in large-text.test.tsx.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text as RNText, type HostInstance } from 'react-native';
import { announce, pressedState } from '../a11y';
import { useReduceMotion } from '../reduceMotion';
import { ThemeProvider } from '../ThemeProvider';
import { BottomSheet } from './BottomSheet';
import { Callout } from './Callout';
import { Pill } from './Pill';
import { Stepper } from './Stepper';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const live = () => document.querySelector('[aria-live="polite"]');

describe('announce (FR-002)', () => {
  it('on the web, says it through the one polite live region', () => {
    vi.useFakeTimers();
    render(<ThemeProvider>{null}</ThemeProvider>);
    act(() => announce('1 minute left on Blind bake'));
    act(() => vi.advanceTimersByTime(100));
    expect(live()?.textContent).toBe('1 minute left on Blind bake');
  });

  it('the servings Stepper says the new count, not on first show', () => {
    vi.useFakeTimers();
    function Servings() {
      const [n, setN] = useState(4);
      return <Stepper value={n} onChange={setN} decreaseLabel="Fewer servings" increaseLabel="More servings" announcement={`${n} servings`} />;
    }
    render(
      <ThemeProvider>
        <Servings />
      </ThemeProvider>,
    );
    act(() => vi.advanceTimersByTime(100));
    expect(live()?.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    act(() => vi.advanceTimersByTime(100));
    expect(live()?.textContent).toBe('5 servings');
  });
});

describe('toggles (FR-006)', () => {
  it('read as pressed on the web and as selected on the phone', () => {
    expect(pressedState(true)).toEqual({ 'aria-pressed': true, accessibilityState: { selected: true } });
    render(<Pill label="Vegetarian" selected />);
    expect(screen.getByRole('button', { name: 'Vegetarian' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Reduce Motion (FR-004)', () => {
  it('follows the setting when it changes while the app is open', async () => {
    let changed: ((on: boolean) => void) | undefined;
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, l: (on: boolean) => void) => {
      changed = l;
      return { remove: vi.fn() };
    }) as never);
    const { result } = renderHook(() => useReduceMotion());
    await act(async () => undefined);
    expect(result.current).toBe(false);
    act(() => changed?.(true));
    expect(result.current).toBe(true);
  });
});

describe('sheets give focus back (FR-003)', () => {
  it('to the button that opened them, on close', () => {
    vi.useFakeTimers();
    function Screen() {
      const [open, setOpen] = useState(false);
      const opener = useRef<HostInstance>(null);
      return (
        <>
          <Pressable ref={opener} role="button" aria-label="Cooking options" onPress={() => setOpen(true)}>
            <RNText>Options</RNText>
          </Pressable>
          <BottomSheet visible={open} onClose={() => setOpen(false)} title="Cooking options" closeLabel="Close" returnFocusRef={opener}>
            <RNText>Screen stays on</RNText>
          </BottomSheet>
        </>
      );
    }
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Cooking options' });
    fireEvent.click(opener);
    act(() => vi.advanceTimersByTime(10));
    expect(document.activeElement).not.toBe(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    act(() => vi.advanceTimersByTime(10));
    expect(document.activeElement).toBe(opener);
  });
});

describe('Callout (User Story 4)', () => {
  it('says a warning as soon as it shows; a tip waits to be read', () => {
    render(<Callout variant="warn" text="Couldn't add to groceries. Try again." />);
    expect(screen.getByRole('alert').textContent).toContain("Couldn't add to groceries");
    cleanup();
    render(<Callout variant="tip" text="Tip: paste a list." />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
