// Spec 057's components: ReminderRow, ActionMenu's dots and groups, CalCard's footer hint, DayChip
// start-aligned and TimeField. Visuals are checked in /dev/gallery; these check behaviour and what
// screen readers get.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionMenu } from './ActionMenu';
import { CalCard } from './CalCard';
import { DayChip } from './DayChip';
import { ReminderRow } from './ReminderRow';
import { Text } from './Text';
import { TimeField } from './TimeField';

afterEach(cleanup);

const gabriel = { initial: 'G', color: 'honey' as const, name: 'Gabriel' };

describe('ReminderRow', () => {
  it('ticks with a named checkbox and names its member, icons and badge', () => {
    const onToggle = vi.fn();
    render(<ReminderRow title="Water the plants" detail="Was due Mon" member={gabriel} late="2d late" repeats="Repeats" notes="Has notes" onToggle={onToggle} toggleLabel="Mark done: Water the plants" />);
    const box = screen.getByRole('checkbox', { name: 'Mark done: Water the plants' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByRole('img', { name: 'Gabriel' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Repeats' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Has notes' })).toBeTruthy();
    expect(screen.getByText('2d late')).toBeTruthy();
  });

  it('drops the badge and icons once done', () => {
    render(<ReminderRow title="Bins" detail="Done just now" member={gabriel} late="1d late" repeats="Repeats" done onToggle={() => {}} toggleLabel="Mark not done: Bins" />);
    expect(screen.getByRole('checkbox', { name: 'Mark not done: Bins' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText('1d late')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Repeats' })).toBeNull();
  });

  it('opens from its title, and has no box when snoozed', () => {
    const onOpen = vi.fn();
    render(<ReminderRow title="Renew the permit" detail="Back tomorrow" member={gabriel} onOpen={onOpen} openLabel="Open Renew the permit" />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Renew the permit' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("can't tick offline", () => {
    const onToggle = vi.fn();
    render(<ReminderRow title="Bins" detail="20:00" member={gabriel} onToggle={onToggle} toggleLabel="Mark done: Bins" disabled />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark done: Bins' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('ActionMenu with dots, a heading, details and a separator', () => {
  it('reads each snooze with its date and runs the pick', () => {
    const tomorrow = vi.fn();
    render(
      <ActionMenu
        trigger="dots"
        label="More options for Bins"
        heading="Snooze until"
        items={[
          { label: 'Tomorrow', detail: 'Thu 12', onPress: tomorrow },
          { label: 'Edit', onPress: () => {}, separatorBefore: true },
        ]}
      />,
    );
    const dots = screen.getByRole('button', { name: 'More options for Bins' });
    expect(dots.getAttribute('aria-haspopup')).toBe('true');
    fireEvent.click(dots);
    expect(dots.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Snooze until')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tomorrow, Thu 12' }));
    expect(tomorrow).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('CalCard footer hint', () => {
  it('is part of the footer link', () => {
    const onPress = vi.fn();
    render(
      <CalCard label="Reminders" header={<Text>Reminders</Text>} addLabel="New reminder" onAdd={() => {}} footer={{ label: 'See all reminders', hint: '2 more today · 1 snoozed', onPress }}>
        <Text>rows</Text>
      </CalCard>,
    );
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('See all reminders');
    expect(link.textContent).toContain('2 more today · 1 snoozed');
    fireEvent.click(link);
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('DayChip start-aligned', () => {
  it('is a pressed-state button named with its date', () => {
    render(<DayChip align="start" label="Next week" sub="Wed, Nov 18" selected onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Next week, Wed, Nov 18' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('TimeField (web)', () => {
  it('passes on what is typed', () => {
    const onChange = vi.fn();
    render(<TimeField label="Time" value="15:00" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Time' }), { target: { value: '16:30' } });
    expect(onChange).toHaveBeenCalledWith('16:30');
  });
});
