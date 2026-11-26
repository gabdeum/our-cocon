// Spec 071: the drawer when the phone moves to another time zone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { expectAccessible } from '../../test/axe';
import { TravelSheet } from './TravelSheet';

afterEach(cleanup);

const ask = { city: 'New York', home: 'Paris', gap: -360, time: '4:00 PM', here: '10:00 AM' };

describe('TravelSheet', () => {
  it('says what changed, shows one event both ways, and offers the two choices', async () => {
    const onKeep = vi.fn();
    const onStay = vi.fn();
    const onKeepFamily = vi.fn();
    const { container } = render(<TravelSheet ask={ask} onKeep={onKeep} onKeepFamily={onKeepFamily} onStay={onStay} />);
    for (const text of [
      'You’re on New York time',
      'Your phone moved to New York time, 6 hours behind Paris. Should your plans keep the times you entered?',
      'For example, an event you added for 4:00 PM:',
      'Stays at 4:00 PM, New York time, for you. The rest of the family stays on Paris time.',
      'The family moves to New York time: everyone’s plans stay at 4:00 PM, New York time, and nobody else is asked.',
      'Happens at 4:00 PM Paris time, which is 10:00 AM in New York.',
      'If only you keep your times, they go back by themselves when your phone is back on Paris time.',
      'Keep my times (I am the only one travelling)',
      'Keep everyone’s time (everyone is travelling)',
    ])
      expect(screen.getByText(text)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my times' }));
    expect(onKeep).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep everyone’s time' }));
    expect(onKeepFamily).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay on Paris time' }));
    expect(onStay).toHaveBeenCalled();
    await expectAccessible(container);
  });

  it('ahead, and half hours', () => {
    render(<TravelSheet ask={{ ...ask, city: 'Kolkata', gap: 270 }} onKeep={vi.fn()} onKeepFamily={vi.fn()} onStay={vi.fn()} />);
    expect(screen.getByText(/4 hours 30 minutes ahead of Paris/)).toBeTruthy();
  });
});
