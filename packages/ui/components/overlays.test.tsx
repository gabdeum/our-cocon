import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet, SheetFooter } from './BottomSheet';
import { Dialog } from './Dialog';
import { Text } from './Text';

afterEach(cleanup);

const flush = () => act(() => new Promise((r) => setTimeout(r, 10)));

describe('BottomSheet', () => {
  const sheet = (props: { dirty?: boolean; onClose: () => void }) => (
    <BottomSheet
      visible
      title="Filters"
      lead="Pick what you feel like."
      closeLabel="Close"
      footer={<SheetFooter cancel={{ label: 'Cancel', onPress: () => undefined }} primary={{ label: 'Show 12 recipes' }} />}
      {...props}
    >
      <Text>Body</Text>
    </BottomSheet>
  );

  it('is a dialog named by its title, with the footer buttons', () => {
    render(sheet({ onClose: () => undefined }));
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show 12 recipes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('closes when the scrim is tapped', () => {
    const onClose = vi.fn();
    render(sheet({ onClose }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open on a scrim tap while there are unsaved changes', () => {
    const onClose = vi.fn();
    render(sheet({ onClose, dirty: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus to the title on open', async () => {
    render(sheet({ onClose: () => undefined }));
    await flush();
    expect(document.activeElement?.textContent).toContain('Filters');
  });
});

describe('Dialog', () => {
  const dialog = (onConfirm = vi.fn(), onCancel = vi.fn()) => (
    <Dialog
      visible
      title="Delete “Leek & bacon quiche”?"
      body="You can restore it from Recently deleted for 30 days."
      confirmLabel="Delete recipe"
      cancelLabel="Keep it"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );

  it('is an alert dialog labelled by its title and described by its body', () => {
    render(dialog());
    const box = screen.getByRole('alertdialog', { name: 'Delete “Leek & bacon quiche”?' });
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('You can restore it from Recently deleted for 30 days.').id).toBe(box.getAttribute('aria-describedby'));
  });

  it('starts focus on the safe button', async () => {
    render(dialog());
    await flush();
    expect(document.activeElement?.textContent).toBe('Keep it');
  });

  it('confirms or keeps', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(dialog(onConfirm, onCancel));
    fireEvent.click(screen.getByRole('button', { name: 'Delete recipe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
