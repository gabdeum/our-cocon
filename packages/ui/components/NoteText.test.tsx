// NoteText (spec 073): every block kind renders, links call back, checklist items read as checkboxes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NoteText, type NoteBlock } from './NoteText';

afterEach(cleanup);

const t = (text: string) => ({ kind: 'text' as const, text });

const blocks: NoteBlock[] = [
  { kind: 'paragraph', spans: [{ kind: 'bold', children: [t('40 nights')] }, t('. Info on '), { kind: 'link', url: 'https://airbnb.com/help', children: [t('airbnb.com/help')] }] },
  { kind: 'boldLine', spans: [t('Steps')] },
  { kind: 'number', n: 1, spans: [t('Feed the starter')] },
  { kind: 'number', n: 2, spans: [t('Mix')] },
  { kind: 'bullet', spans: [t('Onions')] },
  { kind: 'check', done: false, line: 6, spans: [t('Milk')] },
  { kind: 'check', done: true, line: 7, spans: [t('Eggs')] },
];

describe('NoteText', () => {
  it('renders each block with its text', () => {
    render(<NoteText blocks={blocks} onOpenLink={vi.fn()} />);
    for (const text of ['40 nights', 'Steps', 'Feed the starter', 'Mix', 'Onions', 'Milk', 'Eggs']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByRole('list')).toHaveLength(3);
  });

  it('opens a tapped link through the caller', () => {
    const onOpenLink = vi.fn();
    render(<NoteText blocks={blocks} onOpenLink={onOpenLink} />);
    fireEvent.click(screen.getByRole('link', { name: 'airbnb.com/help' }));
    expect(onOpenLink).toHaveBeenCalledWith('https://airbnb.com/help');
  });

  it('shows checklist items as checkboxes, ticked or not', () => {
    render(<NoteText blocks={blocks} onOpenLink={vi.fn()} />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });
});
