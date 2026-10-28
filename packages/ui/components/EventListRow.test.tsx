// Spec 040: Agenda's day card and its event rows (ListRow README › Event row).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EventListGroup, EventListRow, type EventListItem } from './EventListRow';

afterEach(cleanup);

const swim: EventListItem = { key: 'swim', title: 'Baby swim class', sub: '14:30 · Gabriel takes James', tag: null, initials: 'J', colors: ['sky'], label: 'Baby swim class, 14:30 · Gabriel takes James' };
const trip: EventListItem = { key: 'trip', title: 'Lyon trip', sub: 'All day', tag: { label: 'Day 1 of 3', tone: 'soft' }, initials: 'E', colors: ['rose'], label: 'Lyon trip, All day, Day 1 of 3' };

describe('EventListRow', () => {
  it('shows the heading, then each row with its sub-line and tag, and opens a row', () => {
    const onPress = vi.fn();
    render(
      <EventListGroup heading="Tomorrow · Mon, Oct 26">
        <EventListRow event={swim} onPress={onPress} />
        <EventListRow event={trip} onPress={vi.fn()} last />
      </EventListGroup>,
    );
    expect(screen.getByRole('heading').textContent).toBe('Tomorrow · Mon, Oct 26');
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    for (const text of ['Baby swim class', '14:30 · Gabriel takes James', 'J', 'All day', 'Day 1 of 3']) expect(screen.getByText(text)).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: swim.label }));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows Others as a person icon, without initials', () => {
    render(<EventListRow event={{ ...swim, initials: '', colors: ['others'] }} onPress={vi.fn()} last />);
    expect(screen.queryByText('J')).toBeNull();
  });
});
