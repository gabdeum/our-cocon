// Spec 002, User Story 1: /dev/gallery renders every design-system component (FR-002). Visual
// parity is reviewed from 390 px screenshots (SC-002).
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Gallery } from './Gallery';

afterEach(cleanup);

const components = [
  'Button', 'IconButton', 'Pill', 'Tag', 'Switch', 'SegmentedControl', 'Stepper', 'TextField', 'MonthPicker',
  'ListRow', 'Card', 'RecipeItem', 'StatTile', 'Callout', 'Avatar', 'StatusBanner', 'StepCard', 'TimerCard',
  'TimerPill', 'TabBar', 'BottomSheet', 'Dialog', 'Progress', 'ScreenHeader',
];

it('shows a section for each of the 24 design-system components', () => {
  render(<Gallery onBack={() => undefined} onOpenSheetRoute={() => undefined} onOpenModalRoute={() => undefined} />);
  for (const name of components) expect(screen.getByRole('heading', { name }), name).toBeTruthy();
});
