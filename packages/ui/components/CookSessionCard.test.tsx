import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { CookSessionCard } from './CookSessionCard';

afterEach(cleanup);

// Spec 067: in the narrow list beside a recipe, Resume wraps under Cancel and Done instead of squeezing.
describe('CookSessionCard actions', () => {
  it('can wrap, each button keeping room for its label', () => {
    render(
      <CookSessionCard
        variant="list"
        title="Leek & bacon quiche"
        line="Gabriel · since 18:40"
        steps={{ count: 6, current: 2 }}
        openLabel="Resume Leek & bacon quiche at step 3 of 6"
        labels={{ cancel: 'Cancel', done: 'Done', resume: 'Resume' }}
        onCancel={vi.fn()}
        onDone={vi.fn()}
        onResume={vi.fn()}
      />,
    );
    expect(getComputedStyle(screen.getByTestId('cook-actions')).flexWrap).toBe('wrap');
    const resume = screen.getByTestId('cook-resume');
    expect(getComputedStyle(resume).minWidth).toBe('124px');
    expect(within(resume).getByRole('button', { name: 'Resume' })).toBeTruthy();
  });
});
