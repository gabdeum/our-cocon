import { View } from 'react-native';
import { BottomSheet, Button, IconTile, Link, Text } from '@cocon/ui';
import { strings } from '../../strings/en';

const n = strings.notifications;

export interface AskSheetProps {
  /** What led to it (spec 046 FR-002): the first timer, or the first event saved with a reminder. Null: closed. */
  trigger: 'timer' | 'reminder' | null;
  busy?: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
}

/** OC-NotifAsk (design/ui/OC-Notifications.md › Ask sheet): why, then the iPhone's own prompt. */
export function AskSheet({ trigger, busy, onTurnOn, onNotNow }: AskSheetProps) {
  const kind = trigger ?? 'timer';
  return (
    <BottomSheet
      visible={trigger !== null}
      onClose={onNotNow}
      title={n.askTitle[kind]}
      lead={n.askBody[kind]}
      hero={<IconTile icon="bell" tone="honey" size="xl" className="mt-8" />}
      closeLabel={n.close}
      footer={
        <View className="items-center gap-14">
          <Button label={n.turnOn} variant="ink" block busy={busy} busyLabel={n.turnOn} onPress={onTurnOn} />
          <Link label={n.notNow} size={16} className="self-center" onPress={onNotNow} />
          <Text size={13} weight="600" color="ink-muted" align="center">
            {n.note}
          </Text>
        </View>
      }
    >
      {null}
    </BottomSheet>
  );
}
