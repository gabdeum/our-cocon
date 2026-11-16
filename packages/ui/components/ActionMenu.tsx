import { useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions, type HostInstance } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  /** "Delete event": danger, and a Dialog confirms it. */
  tone?: 'danger';
  /** On the right, quieter: when a snooze ends ("Thu 12", spec 057). */
  detail?: string;
  /** A thin line above it, between groups. */
  separatorBefore?: boolean;
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
  /** A small caps label over the items ("Snooze until"). */
  heading?: string;
  /** `round` (default): the 44 round button. `dots`: a plain vertical ⋮, 36 × 44, at a row's end (spec 057). */
  trigger?: 'round' | 'dots';
}

const WIDTH = 236;
const GAP = 8;

/**
 * A round ⋯ button that opens a short menu under it, right-aligned to the button (ActionMenu README;
 * the event page's top bar, spec 050). Closes on a pick, an outside tap or Escape; focus goes back to
 * the button.
 */
export function ActionMenu({ label, items, icon = 'more', disabled, menuLabel, closeLabel, heading, trigger = 'round' }: ActionMenuProps) {
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
      {trigger === 'dots' ? (
        <Pressable
          ref={button}
          role="button"
          aria-label={label}
          aria-haspopup
          aria-expanded={open}
          aria-disabled={disabled || undefined}
          disabled={disabled}
          onPress={() => (open ? close() : show())}
          className={cn('h-control-md w-[36px] items-center justify-center rounded-[12px] active:bg-surface-soft', open && 'bg-surface-soft', disabled && 'opacity-dimmed', focusRing)}
        >
          <Icon name="more-vertical" size={20} color="ink" />
        </Pressable>
      ) : (
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
      )}
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
          {heading ? (
            <Text size={13} weight="900" color="ink-muted" uppercase className="px-12 pb-4 pt-8">
              {heading}
            </Text>
          ) : null}
          {items.map((item) => (
            <View key={item.label}>
              {item.separatorBefore ? <View aria-hidden className="mx-10 my-2 h-px bg-line" /> : null}
              <Pressable
                role="menuitem"
                aria-label={item.detail ? `${item.label}, ${item.detail}` : undefined}
                onPress={() => {
                  close();
                  item.onPress();
                }}
                className={cn('min-h-[48px] flex-row items-center justify-between gap-8 rounded-[12px] px-12 active:bg-surface-soft', focusRing)}
              >
                <Text size={16} weight={item.tone === 'danger' ? '800' : '700'} color={item.tone === 'danger' ? 'danger' : 'ink'}>
                  {item.label}
                </Text>
                {item.detail ? (
                  <Text size={14} weight="700" color="ink-muted">
                    {item.detail}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      </Modal>
    </View>
  );
}
