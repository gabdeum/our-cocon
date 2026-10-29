// Spec 042: the event page's pieces: icon rows, member badges, the three-choice delete Dialog and
// the Undo toast that only tells.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from './Dialog';
import { IconRow, ListGroup } from './ListRow';
import { MemberBadge } from './MemberChip';
import { UndoToast } from './Toast';

afterEach(cleanup);

describe('IconRow', () => {
  it('shows its title, sub-line and link; only the link is a control', () => {
    const onPress = vi.fn();
    render(
      <ListGroup inset>
        <IconRow icon="clock" title="Saturday, Oct 31" sub="Morning · about 09:00–12:00" />
        <IconRow icon="pin" title="Little Notes studio" action={{ label: 'Open in Maps', accessibilityLabel: 'Open Little Notes studio in Maps', onPress }} last />
      </ListGroup>,
    );
    expect(screen.getByText('Saturday, Oct 31')).toBeTruthy();
    expect(screen.getByText('Morning · about 09:00–12:00')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open Little Notes studio in Maps' }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('MemberBadge', () => {
  it('shows the initial and the name, and is not a control', () => {
    render(<MemberBadge name="James" initial="J" color="sky" />);
    expect(screen.getByText('James')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Dialog with a second choice', () => {
  it('offers both destructive choices and the safe one', () => {
    const onConfirm = vi.fn();
    const onSecondary = vi.fn();
    render(
      <Dialog
        visible
        title="Delete “Baby music class”?"
        body="Eva added this. Delete only this one, or this and all future ones? It's removed for the whole family."
        confirmLabel="Only this one"
        onConfirm={onConfirm}
        secondaryLabel="This and all future ones"
        onSecondary={onSecondary}
        cancelLabel="Keep it"
        onCancel={vi.fn()}
      />,
    );
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Only this one', 'This and all future ones', 'Keep it']);
    fireEvent.click(screen.getByRole('button', { name: 'This and all future ones' }));
    expect(onSecondary).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('UndoToast without Undo', () => {
  it('only tells', () => {
    render(<UndoToast text="Couldn't undo. Check your connection and try again." undoLabel="Undo" />);
    expect(screen.getByRole('status').textContent).toBe("Couldn't undo. Check your connection and try again.");
    expect(screen.queryByRole('button')).toBeNull();
  });
});
