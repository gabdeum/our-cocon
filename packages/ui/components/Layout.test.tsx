import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pressable, View } from 'react-native';
import { AppFrame, PushedScreen, TabScreen } from './Layout';
import { Text } from './Text';

const dims = vi.hoisted(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims }) }));

afterEach(() => {
  cleanup();
  dims.width = 390;
});

const frameWidth = () => getComputedStyle(screen.getByTestId('app-frame')).maxWidth;

// Spec 063 FR-005: on the web, the phone layout is centred at max 560 below 600 wide; from 600 the
// app grows up to 1200, then centres (the tab bar lives inside).
it('caps the web app at 560 on the phone tier and 1200 from 600, centred', () => {
  render(
    <AppFrame>
      <Text>Content</Text>
    </AppFrame>,
  );
  expect(frameWidth()).toBe('560px');
  expect(getComputedStyle(screen.getByTestId('app-frame').parentElement as HTMLElement).alignItems).toBe('center');
  cleanup();
  dims.width = 820;
  render(
    <AppFrame>
      <Text>Content</Text>
    </AppFrame>,
  );
  expect(frameWidth()).toBe('1200px');
  // Spec 064: from 960 the 104 rail sits inside the frame, so content beside it still reaches 1200.
  cleanup();
  dims.width = 1400;
  render(
    <AppFrame>
      <Text>Content</Text>
    </AppFrame>,
  );
  expect(frameWidth()).toBe('1304px');
});

// SC-003: rotating or resizing re-renders, nothing remounts, so state (a timer, a step) stays.
it('keeps what is open while the window changes tier', () => {
  function Counter() {
    const [n, setN] = useState(0);
    return (
      <Pressable role="button" aria-label="Next step" onPress={() => setN(n + 1)}>
        <Text>{`Step ${n}`}</Text>
      </Pressable>
    );
  }
  dims.width = 1180;
  const { rerender } = render(
    <AppFrame>
      <Counter />
    </AppFrame>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  for (const width of [590, 820, 1180]) {
    dims.width = width;
    rerender(
      <AppFrame>
        <Counter />
      </AppFrame>,
    );
    expect(screen.getByText('Step 2')).toBeTruthy();
  }
});

// SC-004 / FR-002: the phone keeps its own classes (54 top, 20 gutter) with no inline override; from
// 600 the top is the safe area + 24. (Vitest doesn't run NativeWind, so only inline styles show here.)
it('keeps the phone spacing below 600 and sets the wide top from 600', () => {
  const top = () => getComputedStyle(screen.getByTestId('body').parentElement as HTMLElement).paddingTop;
  for (const Screen of [TabScreen, PushedScreen]) {
    dims.width = 390;
    render(
      <Screen>
        <View testID="body" />
      </Screen>,
    );
    expect(top()).toBe('0px');
    cleanup();
    dims.width = 820;
    render(
      <Screen>
        <View testID="body" />
      </Screen>,
    );
    expect(top()).toBe('24px');
    cleanup();
  }
});

// Spec 064 FR-003: tab screens keep 180 under their content for the floating bar below 960, and 28
// beside the rail, where nothing floats at the bottom.
it('pads tab screens 180 at the bottom below 960 and 28 from 960', () => {
  const bottom = () => getComputedStyle(screen.getByTestId('body').parentElement as HTMLElement).paddingBottom;
  for (const [width, pad] of [
    [390, '180px'],
    [959, '180px'],
    [960, '28px'],
  ] as const) {
    dims.width = width;
    render(
      <TabScreen>
        <View testID="body" />
      </TabScreen>,
    );
    expect(bottom()).toBe(pad);
    cleanup();
    render(
      <TabScreen pinned={<View />}>
        <View testID="body" />
      </TabScreen>,
    );
    expect(getComputedStyle(screen.getByTestId('body').parentElement?.parentElement as HTMLElement).paddingBottom).toBe(pad);
    cleanup();
  }
});
