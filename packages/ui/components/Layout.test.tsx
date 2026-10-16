import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppFrame } from './Layout';
import { theme } from '../theme';
import { Text } from './Text';

afterEach(cleanup);

// Edge case: on web wider than 720 px, content is centred at max 720 (the tab bar lives inside).
it('caps the app at 720 px wide and centres it', () => {
  render(
    <AppFrame>
      <Text>Content</Text>
    </AppFrame>,
  );
  expect(theme.layout.maxWidth).toBe(720);
  const frame = screen.getByTestId('app-frame');
  expect(getComputedStyle(frame).maxWidth).toBe('720px');
  expect(getComputedStyle(frame.parentElement as HTMLElement).alignItems).toBe('center');
});
