// Spec 073, Warnings and errors: a note the parser can't read shows as typed, and only that is reported.
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { Notes } from './Notes';

vi.mock('../../lib/notes', async (actual) => ({
  ...(await actual<typeof import('../../lib/notes')>()),
  readNotes: (notes: string) => ({ blocks: [{ kind: 'paragraph', spans: [{ kind: 'text', text: notes }] }], failed: true }),
}));

afterEach(cleanup);

it('shows the note as typed and sends note_parse_failed without its text', () => {
  const tracker = { track: vi.fn() };
  render(<Notes notes="**Milk** and eggs" entity="reminder" itemId="r1" tracker={tracker as never} />);
  expect(screen.getByText('**Milk** and eggs')).toBeTruthy();
  expect(tracker.track).toHaveBeenCalledWith('note_parse_failed', { entity: 'reminder' });
  expect(tracker.track).toHaveBeenCalledTimes(1);
});
