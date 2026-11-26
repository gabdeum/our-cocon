import { View } from 'react-native';
import { BottomSheet, Button, IconTile, Link, Text } from '@cocon/ui';
import { strings } from '../../strings/en';

const t = strings.travel;

export interface TravelSheetProps {
  /** Null: closed. */
  ask: {
    /** "New York", "Paris". */
    city: string;
    home: string;
    /** Minutes the phone's clock is ahead of home (negative: behind). */
    gap: number;
    /** "4:00 PM" or "16:00", and that time at home on the phone's clock. */
    time: string;
    here: string;
  } | null;
  busy?: 'keep' | 'family' | 'home' | null;
  onKeep: () => void;
  /** Spec 071 FR-007: the whole family is travelling. */
  onKeepFamily: () => void;
  onStay: () => void;
}

/** One way to go, as a line under its name, in the example card. */
function Choice({ title, sub }: { title: string; sub: string }) {
  return (
    <View>
      <Text size={16} weight="900">
        {title}
      </Text>
      <Text size={15} weight="600" color="ink-muted">
        {sub}
      </Text>
    </View>
  );
}

/**
 * Spec 071 (design/ui/OC-TravelTimeZone.md): the phone moved to another time zone. What changed,
 * one example event shown each way, and the three choices. Closing it is "Stay on home time".
 */
export function TravelSheet({ ask, busy, onKeep, onKeepFamily, onStay }: TravelSheetProps) {
  const a = ask ?? { city: '', home: '', gap: 0, time: '', here: '' };
  return (
    <BottomSheet
      visible={ask !== null}
      onClose={onStay}
      title={t.title(a.city)}
      lead={t.lead(a.city, a.home, t.gap(a.gap))}
      hero={<IconTile icon="plane" tone="honey" size="xl" className="mt-8" />}
      closeLabel={t.close}
      footer={
        <View className="items-center gap-14">
          <Button label={t.keep} variant="ink" block busy={busy === 'keep'} busyLabel={t.keep} onPress={onKeep} />
          <Button label={t.keepFamily} variant="soft" block busy={busy === 'family'} busyLabel={t.keepFamily} onPress={onKeepFamily} />
          <Link label={t.stay(a.home)} size={16} className="self-center" onPress={onStay} />
          <Text size={13} weight="600" color="ink-muted" align="center">
            {t.note(a.home)}
          </Text>
        </View>
      }
    >
      <View className="gap-12 rounded-xl bg-surface-soft p-16">
        <Text size={15} weight="700">
          {t.exampleAt(a.time)}
        </Text>
        <Choice title={t.keepTitle} sub={t.keepSub(a.time, a.city, a.home)} />
        <Choice title={t.keepFamilyTitle} sub={t.keepFamilySub(a.time, a.city)} />
        <Choice title={t.stay(a.home)} sub={t.staySub(a.time, a.here, a.home, a.city)} />
      </View>
    </BottomSheet>
  );
}
