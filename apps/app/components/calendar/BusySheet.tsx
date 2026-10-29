import { View } from 'react-native';
import type { SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { Avatar, BottomSheet, Button, Icon, Text } from '@cocon/ui';
import { busyLines } from '../../lib/event-detail';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const b = strings.calendar.busy;

/**
 * OC-CalBusy (spec 043): what others see when they tap someone's private event, over any calendar
 * view. Who and when, and that the details are private; nothing else reaches the app (the
 * database sends "Busy").
 */
export function BusySheet({ occurrence, members, slotTimes, onClose }: { occurrence: StoredEvent; members: readonly Member[]; slotTimes: SlotTimes; onClose: () => void }) {
  const { creator, when } = busyLines(occurrence, members, slotTimes);
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={b.title(creator?.name ?? b.someone)}
      lead={when}
      leading={creator ? <Avatar initial={creator.initial} color={creator.color} size="xl" /> : null}
      closeLabel={strings.calendar.add.close}
      footer={<Button label={b.ok} block onPress={onClose} />}
    >
      <View className="flex-row items-center gap-10 rounded-lg bg-surface-card px-16 py-14">
        <Icon name="lock" size={22} color="olive" />
        <Text size={16} weight="700" className="flex-1" style={{ lineHeight: 16 * 1.4 }}>
          {creator ? b.body(creator.name) : b.bodySomeone}
        </Text>
      </View>
    </BottomSheet>
  );
}
