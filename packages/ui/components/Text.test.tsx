import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';

afterEach(cleanup);

it('renders text in the Nunito file for its weight', () => {
  render(
    <ThemeProvider>
      <Text variant="displayXl">Groceries</Text>
      <Icon name="home" />
    </ThemeProvider>,
  );
  const el = screen.getByText('Groceries');
  expect(getComputedStyle(el).fontFamily).toBe('Nunito_900Black');
  expect(getComputedStyle(el).fontSize).toBe('32px');
});
