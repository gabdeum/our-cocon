import { useEffect, useId, useRef } from 'react';
import { Modal, View } from 'react-native';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface DialogProps {
  visible: boolean;
  /** The action as a question: "Delete “Leek & bacon quiche”?" */
  title: string;
  /** The consequence and the way back: "…for 30 days." */
  body: string;
  /** "Delete recipe". */
  confirmLabel: string;
  onConfirm: () => void;
  /** "Keep it": the safe choice, focused first. */
  cancelLabel: string;
  onCancel: () => void;
  icon?: IconName;
}

/** Centred confirmation for destructive or irreversible actions only (Dialog README). */
export function Dialog({ visible, title, body, confirmLabel, onConfirm, cancelLabel, onCancel, icon = 'trash' }: DialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const safeRef = useRef<View>(null);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => (safeRef.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-scrim px-20">
        <View
          role="alertdialog"
          aria-modal
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className="w-full max-w-frame items-center gap-14 rounded-[30px] bg-surface-page px-20 pb-20 pt-24"
        >
          <View aria-hidden className="h-[60px] w-[60px] items-center justify-center rounded-full bg-warn-soft">
            <Icon name={icon} size={28} color="danger" />
          </View>
          <Text size={22} weight="900" align="center" nativeID={titleId} role="heading">
            {title}
          </Text>
          <Text size={16} weight="600" color="ink-muted" align="center" nativeID={bodyId} style={{ lineHeight: 16 * 1.45 }}>
            {body}
          </Text>
          <View className="gap-10 self-stretch">
            <Button label={confirmLabel} variant="danger" size="dialog" block onPress={onConfirm} />
            <View ref={safeRef} tabIndex={-1} className="web:outline-none">
              <Button label={cancelLabel} variant="soft" size="dialog" block onPress={onCancel} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
