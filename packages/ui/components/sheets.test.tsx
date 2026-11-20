// Spec 065: one BottomSheet, three presentations by tier: the bottom sheet below 600, a popover
// for menus and a centred card for flows from 600.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import type { HostInstance } from 'react-native';
import { BottomSheet, SheetFooter } from './BottomSheet';
import { IconButton } from './IconButton';
import { Text } from './Text';

const env = vi.hoisted(() => ({ width: 390, height: 844, os: 'web' }));
vi.mock('react-native', async (actual) => {
  const rn = await actual<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: env.width, height: env.height, scale: 2, fontScale: 1 }),
    Platform: new Proxy(rn.Platform, { get: (t, k) => (k === 'OS' ? env.os : Reflect.get(t, k)) }),
  };
});

afterEach(() => {
  cleanup();
  env.width = 390;
  env.height = 844;
  env.os = 'web';
});

const flush = () => act(() => new Promise((r) => setTimeout(r, 10)));

function Menu({ onClose, anchored = true, dirty }: { onClose: () => void; anchored?: boolean; dirty?: boolean }) {
  const button = useRef<HostInstance>(null);
  return (
    <>
      <IconButton ref={button} icon="settings" label="Cooking options" variant="round" expanded onPress={() => undefined} />
      <BottomSheet visible kind="menu" returnFocusRef={anchored ? button : undefined} title="Cooking settings" closeLabel="Close cooking settings" onClose={onClose} dirty={dirty}>
        <Text>Keep the screen on</Text>
      </BottomSheet>
    </>
  );
}

const flow = (onClose: () => void, dirty?: boolean) => (
  <BottomSheet
    visible
    title="Share this recipe"
    closeLabel="Close"
    onClose={onClose}
    dirty={dirty}
    footer={<SheetFooter primary={{ label: 'Copy' }} />}
  >
    <Text>Body</Text>
  </BottomSheet>
);

describe('below 600: the bottom sheet, as today', () => {
  it('has its handle, its scrim and no ✕, for a menu or a flow', async () => {
    render(<Menu onClose={() => undefined} />);
    await flush();
    expect(screen.getByRole('dialog', { name: 'Cooking settings' }).dataset.testid).toBe('sheet');
    cleanup();
    render(flow(() => undefined));
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
  });
});

describe.each([820, 1180])('at %i wide', (width) => {
  it('opens a menu as a popover under its button: an outside tap closes it', async () => {
    env.width = width;
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);
    await flush();
    expect(screen.getByRole('dialog', { name: 'Cooking settings' }).dataset.testid).toBe('sheet-popover');
    fireEvent.click(screen.getByRole('button', { name: 'Close cooking settings' }));
    expect(onClose).toHaveBeenCalledOnce();
    // No ✕ in a popover, and the opening button shows it's open.
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cooking options' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the popover on Escape', async () => {
    env.width = width;
    const onClose = vi.fn();
    render(<Menu onClose={onClose} />);
    await flush();
    fireEvent.keyUp(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps a popover with unsaved changes open on an outside tap', async () => {
    env.width = width;
    const onClose = vi.fn();
    render(<Menu onClose={onClose} dirty />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close cooking settings' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens a menu with no button to point at as a card', async () => {
    env.width = width;
    render(<Menu onClose={() => undefined} anchored={false} />);
    await flush();
    expect(screen.getByRole('dialog', { name: 'Cooking settings' }).dataset.testid).toBe('sheet-card');
  });

  it('opens a flow as a centred card: the scrim and its ✕ close it', async () => {
    env.width = width;
    const onClose = vi.fn();
    render(flow(onClose));
    await flush();
    const card = screen.getByRole('dialog', { name: 'Share this recipe' });
    expect(card.dataset.testid).toBe('sheet-card');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(card.parentElement?.previousElementSibling as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps a card with unsaved changes open on a scrim tap', async () => {
    env.width = width;
    const onClose = vi.fn();
    render(flow(onClose, true));
    await flush();
    const card = screen.getByRole('dialog', { name: 'Share this recipe' });
    fireEvent.click(card.parentElement?.previousElementSibling as Element);
    expect(onClose).not.toHaveBeenCalled();
  });
});


// FR-004: on the iPad, the card sits in a KeyboardAvoidingView, so it moves up above the keyboard.
it('keeps the card above the keyboard on the iPad', async () => {
  env.width = 820;
  env.os = 'ios';
  render(flow(() => undefined));
  await flush();
  expect(screen.getByTestId('sheet-keyboard').contains(screen.getByRole('dialog', { name: 'Share this recipe' }))).toBe(true);
});
