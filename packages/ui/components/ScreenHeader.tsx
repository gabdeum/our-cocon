import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Button, Link } from './Button';
import { Icon, Logo } from './Icon';
import { Text } from './Text';

export interface TabHeaderProps {
  title: string;
  /** "7 items to buy · shared with family". */
  sub?: string;
  /** Small olive Button "New", or a Presence pill; aligned to the bottom of the title. */
  action?: ReactNode;
}

/** Tab-screen title (ScreenHeader README › Tab title). */
export function TabHeader({ title, sub, action }: TabHeaderProps) {
  return (
    <View className="flex-row items-end justify-between gap-12">
      <View className="min-w-0 flex-1">
        <Text variant="displayXl" role="heading" aria-level={1}>
          {title}
        </Text>
        {sub ? (
          <Text size={15} weight="700" color="ink-muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export interface BrandHeaderProps {
  /** "Our Cocon". */
  brand: string;
  /** AvatarStack of the family. */
  avatars?: ReactNode;
  /** "Thursday 16 October". */
  date: string;
  /** "Good evening, Gabriel". */
  greeting: string;
}

/** Home's brand row, date and greeting (ScreenHeader README › Brand row). */
export function BrandHeader({ brand, avatars, date, greeting }: BrandHeaderProps) {
  return (
    <View className="gap-14">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-8">
          <Logo size={34} />
          <Text variant="titleSm" style={{ letterSpacing: -0.3 }}>
            {brand}
          </Text>
        </View>
        {avatars}
      </View>
      <View>
        <Text size={15} weight="700" color="olive">
          {date}
        </Text>
        <Text variant="displayXl" role="heading" aria-level={1}>
          {greeting}
        </Text>
      </View>
    </View>
  );
}

export interface BackHeaderProps {
  /** The parent's name: "Settings". */
  backLabel: string;
  onBack: () => void;
  title: string;
  lead?: string;
  /** A summary right of the title, on its baseline: "1 running · 3 total" (Timers). The title is then 32. */
  aside?: string;
}

/** Pushed screen without a photo (ScreenHeader README › Back link). */
export function BackHeader({ backLabel, onBack, title, lead, aside }: BackHeaderProps) {
  return (
    <View className={aside ? 'gap-8' : 'gap-[2px]'}>
      <Pressable role="link" onPress={onBack} className={cn('h-control-md flex-row items-center gap-4 self-start', focusRing)}>
        <Icon name="back" size={22} color="olive" />
        <Text size={16} weight="800" color="olive">
          {backLabel}
        </Text>
      </Pressable>
      {aside ? (
        <View className="flex-row items-baseline justify-between gap-12">
          <Text variant="displayXl" role="heading" aria-level={1}>
            {title}
          </Text>
          <Text size={15} weight="700" color="ink-muted" className="shrink">
            {aside}
          </Text>
        </View>
      ) : (
        <Text variant="displayLg" role="heading" aria-level={1}>
          {title}
        </Text>
      )}
      {lead ? (
        <Text size={15} weight="600" color="ink-muted">
          {lead}
        </Text>
      ) : null}
    </View>
  );
}

export interface FormBarProps {
  cancelLabel: string;
  onCancel: () => void;
  title: string;
  saveLabel: string;
  onSave: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  savingLabel?: string;
  /** FormProgress with the section names. */
  progress?: ReactNode;
}

/** Create/edit form bar (ScreenHeader README › Form bar): Cancel · title · Save, then Progress. */
export function FormBar({ cancelLabel, onCancel, title, saveLabel, onSave, saveDisabled, saving, savingLabel, progress }: FormBarProps) {
  return (
    <View className="gap-12">
      {/* Equal side columns keep the title centred whatever the Cancel and Save widths. */}
      <View className="flex-row items-center gap-8">
        <View className="flex-1 items-start">
          <Link label={cancelLabel} tone="quiet" size={16} onPress={onCancel} />
        </View>
        <Text size={17} weight="900" role="heading" aria-level={1} numberOfLines={1} align="center" className="shrink">
          {title}
        </Text>
        <View className="flex-1 items-end">
          <Button label={saveLabel} variant="olive" size="sm" onPress={onSave} disabled={saveDisabled} busy={saving} busyLabel={savingLabel} />
        </View>
      </View>
      {progress}
    </View>
  );
}
