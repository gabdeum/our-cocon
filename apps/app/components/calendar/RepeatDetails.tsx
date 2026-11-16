import { View } from 'react-native';
import { dateLabel } from '@cocon/calendar';
import { Choice, PickerField, PillRow, Text, TextField, WeekdayPicker } from '@cocon/ui';
import { endsProblem, type EndsChoice, type RepeatDraft } from '../../lib/event-form';
import { strings } from '../../strings/en';

const a = strings.calendar.add;

/** Weekly's "On" days and every repeat's "Ends" (OC-CalAddMore), in a white card; also the reminder sheet's Custom repeat (spec 057). */
export function RepeatDetails({ d, set, tried, onPickEnd }: { d: RepeatDraft; set: (patch: Partial<RepeatDraft>) => void; tried: boolean; onPickEnd: () => void }) {
  const ends: { key: EndsChoice['type']; label: string }[] = [
    { key: 'never', label: a.endsNever },
    { key: 'on', label: a.endsOn },
    { key: 'after', label: a.endsAfter },
  ];
  const chooseEnd = (key: EndsChoice['type']) => {
    if (key === 'on') onPickEnd();
    else set({ ends: key === 'never' ? { type: 'never' } : { type: 'after', count: d.ends.type === 'after' ? d.ends.count : '10' } });
  };
  return (
    <View className="gap-8 rounded-lg bg-surface-card p-12">
      {d.repeat === 'weekly' ? (
        <>
          <Text size={14} weight="800">
            {a.on}
          </Text>
          <WeekdayPicker
            label={a.on}
            letters={a.weekdayLetters}
            names={a.weekdayNames}
            value={d.weekdays}
            onToggle={(day) => set({ weekdays: d.weekdays.includes(day) ? d.weekdays.filter((x) => x !== day) : [...d.weekdays, day] })}
          />
        </>
      ) : null}
      <Text size={14} weight="800">
        {a.endsLabel}
      </Text>
      <PillRow>
        {ends.map((e) => (
          <Choice key={e.key} label={e.label} selected={d.ends.type === e.key} onPress={() => chooseEnd(e.key)} />
        ))}
      </PillRow>
      {d.ends.type === 'on' ? <PickerField label={a.lastDay} value={dateLabel(d.ends.date)} placeholder={a.pickDate} onPress={onPickEnd} /> : null}
      {d.ends.type === 'after' ? (
        <TextField
          label={a.times}
          hint={a.timesHint}
          inputMode="numeric"
          maxLength={4}
          value={d.ends.count}
          onChangeText={(count) => set({ ends: { type: 'after', count } })}
          warning={tried && endsProblem(d) ? a.timesProblem : undefined}
        />
      ) : null}
    </View>
  );
}

