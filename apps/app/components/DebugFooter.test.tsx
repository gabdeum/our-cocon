import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DebugFooter } from './DebugFooter';

afterEach(cleanup);

const commit = '3f2a9c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a49';

it('shows the short commit on staging', () => {
  render(<DebugFooter config={{ env: 'staging', commit }} />);
  expect(screen.getByText('Build 3f2a9c1')).toBeTruthy();
});

it('is hidden on prod', () => {
  render(<DebugFooter config={{ env: 'prod', commit }} />);
  expect(screen.queryByText(/Build/)).toBeNull();
});
