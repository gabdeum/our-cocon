// Spec 074: the notes field's toolbar on the web, Enter in a list, the "Add a link" sheet, the
// length guard and `note_format_applied`.
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { NotesField } from './NotesField';

afterEach(cleanup);

function Field({ initial, tracker }: { initial: string; tracker: { track: ReturnType<typeof vi.fn> } }) {
  const [notes, setNotes] = useState(initial);
  return <NotesField label="Notes" placeholder="Anything to remember" value={notes} onChange={setNotes} entity="reminder" tracker={tracker as never} />;
}

const setup = (initial: string) => {
  const tracker = { track: vi.fn() };
  render(<Field initial={initial} tracker={tracker} />);
  const box = screen.getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement;
  const select = (start: number, end = start) => {
    box.setSelectionRange(start, end);
    fireEvent.select(box);
  };
  return { tracker, box, select };
};

describe('NotesField', () => {
  it('shows the formatting toolbar above the field on the web, without Hide keyboard', () => {
    setup('');
    const bar = screen.getByRole('toolbar', { name: 'Formatting' });
    for (const name of ['Bold', 'Link', 'Bulleted list', 'Numbered list', 'Checklist']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide keyboard' })).toBeNull();
    const box = screen.getByRole('textbox', { name: 'Notes' });
    expect(bar.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('bolds the selection, then takes the bold off, and says so each time', () => {
    const { tracker, box, select } = setup('Feed at a 1:1:1 ratio');
    select(10, 21);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box.value).toBe('Feed at a **1:1:1 ratio**');
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box.value).toBe('Feed at a 1:1:1 ratio');
    expect(tracker.track.mock.calls).toEqual([
      ['note_format_applied', { entity: 'reminder', format: 'bold', action: 'add' }],
      ['note_format_applied', { entity: 'reminder', format: 'bold', action: 'remove' }],
    ]);
  });

  it('writes a checklist with the toolbar and Enter (SC-001)', () => {
    const { tracker, box, select } = setup('onion');
    select(5);
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    expect(box.value).toBe('- [ ] onion');
    expect(screen.getByRole('button', { name: 'Checklist' }).getAttribute('aria-pressed')).toBe('true');
    select(11);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(box.value).toBe('- [ ] onion\n- [ ] ');
    select(18);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(box.value).toBe('- [ ] onion\n');
    // Enter is typing, not a toolbar change.
    expect(tracker.track).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith('note_format_applied', { entity: 'reminder', format: 'check', action: 'add' });
  });

  it('adds a link from the sheet, with https:// when it had no scheme', () => {
    const { tracker, box, select } = setup('Use bread flour');
    select(4, 15);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect((screen.getByRole('textbox', { name: 'Text' }) as HTMLInputElement).value).toBe('bread flour');
    const add = screen.getByRole('button', { name: 'Add link' });
    expect(add.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'hello' } });
    expect(screen.getByText('Enter a web or email address')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'example.com/flour' } });
    expect(screen.queryByText('Enter a web or email address')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(box.value).toBe('Use [bread flour](https://example.com/flour)');
    expect(screen.queryByRole('textbox', { name: 'Link' })).toBeNull();
    expect(tracker.track).toHaveBeenCalledWith('note_format_applied', { entity: 'reminder', format: 'link', action: 'add' });
  });

  it("doesn't make a change past 5,000 characters and says why", () => {
    const { tracker, box, select } = setup('a'.repeat(4999));
    select(4999);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box.value).toHaveLength(4999);
    expect(screen.getByText('Notes can be up to 5,000 characters.')).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
