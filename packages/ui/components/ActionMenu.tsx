import { useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions, type HostInstance } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import type { IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  /** "Delete event": danger, and a Dialog confirms it. */
  tone?: 'danger';
}

export interface ActionMenuProps {
  /** "More actions". */
  label: string;
  items: ActionMenuItem[];
  icon?: IconName;
  disabled?: boolean;
  /** Read by a screen reader as the menu's name; defaults to `label`. */
  menuLabel?: string;
  /** The backdrop's name for screen readers, "Close": a way out besides Escape and Back (spec 030). */
  closeLabel?: string;
}

const WIDTH = 236;
const GAP = 8;

/**
 * A round ⋯ button that opens a short menu under it, right-aligned to the button (ActionMenu README;
 * the event page's top bar, spec 050). Closes on a pick, an outside tap or Escape; focus goes back to
 * the button.
 */
export function ActionMenu({ label, items, icon = 'more', disabled, menuLabel, closeLabel }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 120, right: 16 });
  const button = useRef<HostInstance>(null);
  const { width } = useWindowDimensions();

  const show = () => {
    const node = button.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    node?.measureInWindow?.((x, y, w, h) => setAt({ top: y + h + GAP, right: Math.max(0, width - (x + w)) }));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setTimeout(() => (button.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
  };

  return (
    <View>
      <IconButton
        ref={button}
        variant="round"
        icon={icon}
        label={label}
        disabled={disabled}
        aria-haspopup
        aria-expanded={open}
        onPress={() => (open ? close() : show())}
      />
      {/* The Modal gives Escape (web) and Back (Android); the clear backdrop closes on an outside tap. */}
      <Modal transparent visible={open} animationType="none" onRequestClose={close}>
        {closeLabel ? (
          <Pressable role="button" aria-label={closeLabel} onPress={close} className="absolute inset-0" />
        ) : (
          <Pressable aria-hidden onPress={close} className="absolute inset-0" />
        )}
        <View
          role="menu"
          aria-label={menuLabel ?? label}
          className="absolute rounded-[18px] bg-surface-card p-6"
          style={{ top: at.top, right: at.right, width: WIDTH, boxShadow: theme.shadow.popover }}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              role="menuitem"
              onPress={() => {
                close();
                item.onPress();
              }}
              className={cn('min-h-[48px] justify-center rounded-[12px] px-12 active:bg-surface-soft', focusRing)}
            >
              <Text size={16} weight={item.tone === 'danger' ? '800' : '700'} color={item.tone === 'danger' ? 'danger' : 'ink'}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}
