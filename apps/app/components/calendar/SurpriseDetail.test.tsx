// Spec 043 US2: OC-CalSurprise, Gabriel's surprise dinner as Eva sees it: the cover, the time, the
// place and "Note from Gabriel", and nothing to change.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { NOW, babyMusic, eva, members } from '../../test/baby-music';
import { gabriel } from '../../test/fakes';
import { ToastProvider } from '../../lib/toast';
import { SurpriseDetail, type SurpriseDetailProps } from './SurpriseDetail';

afterEach(cleanup);

// What events_visible gives Eva: the cover, shaped like a family event, marked as a cover.
const cover = babyMusic({
  title: 'Dinner out',
  category: null,
  location: 'Café Lalo',
  notes: 'Meet at Café Lalo at 19:30. Dress nice!',
  reminder: 'none',
  starts_on: '2026-10-31',
  ends_on: '2026-10-31',
  slots: ['evening'],
  recurrence: null,
  members: [eva.id],
  responsible_member_id: null,
  creator_member_id: gabriel.id,
  created_by: gabriel.user_id,
  created_at: '2026-10-31T08:00:00Z',
  checklist: [],
  view: 'cover',
});

function setup(over: Partial<SurpriseDetailProps> = {}) {
  const props: SurpriseDetailProps = { occurrence: cover, members, slotTimes: DEFAULT_SLOT_TIMES, now: NOW, onBack: vi.fn(), onOpenUrl: vi.fn(), onCopy: vi.fn(async () => undefined), ...over };
  render(
    <ToastProvider>
      <SurpriseDetail {...props} />
    </ToastProvider>,
  );
  return props;
}

describe('SurpriseDetail (OC-CalSurprise)', () => {
  it('US2: shows the cover, the time, the place and the note from Gabriel, in order', () => {
    setup();
    const text = document.body.textContent ?? '';
    // The top bar first (spec 050): back, and the title it shows once the heading scrolls under it.
    expect(screen.getByRole('button', { name: 'Back to Calendar' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Dinner out']);
    const order = ['Dinner out', 'Eva', 'Saturday, Oct 31', 'Evening · about 18:00–22:00', 'Café Lalo', 'Copy', 'Open in Maps', 'Note from Gabriel', 'Meet at Café Lalo at 19:30. Dress nice!', 'Added by Gabriel'];
    expect(order.map((t) => text.indexOf(t))).toEqual([...order.map((t) => text.indexOf(t))].sort((x, y) => x - y));
    expect(order.every((t) => text.includes(t))).toBe(true);
  });

  it('offers nothing to change: no Edit, Duplicate, Share or Delete', () => {
    setup();
    for (const name of ['Edit', 'Duplicate', 'Share a view-only link', 'Delete event']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByText('Surprise')).toBeNull();
  });

  it('opens the place in Google Maps or copies it, and hides the note card without a note', async () => {
    const props = setup({ occurrence: { ...cover, notes: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Café Lalo' }));
    expect(props.onCopy).toHaveBeenCalledWith('Café Lalo');
    expect(await screen.findByText('Address copied')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Café Lalo in Google Maps' }));
    expect(props.onOpenUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Lalo');
    expect(screen.queryByText('Note from Gabriel')).toBeNull();
  });
});
