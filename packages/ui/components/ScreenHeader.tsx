import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Link } from './Button';
import { Logo } from './Icon';
import { Text } from './Text';

export interface TabHeaderProps {
  title: string;
  /** "7 items to buy · shared with family". */
  sub?: string;
  /** Small olive Button "New", or a Presence pill; centred on the title's line. */
  action?: ReactNode;
}

/**
 * Tab-screen title (ScreenHeader README › Tab title). The title's line is 44 tall (a small button's
 * height) with or without an action, so every tab's title sits at the same height, the calendar's too.
 */
export function TabHeader({ title, sub, action }: TabHeaderProps) {
  return (
    <View>
      <View className="min-h-control-md flex-row items-center justify-between gap-12">
        <Text variant="displayXl" role="heading" aria-level={1} className="min-w-0 flex-1">
          {title}
        </Text>
        {action}
      </View>
      {sub ? (
        <Text size={15} weight="700" color="ink-muted">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export interface BrandRowProps {
  /** "Our Cocon". */
  brand: string;
  /** AvatarStack of the family. */
  avatars?: ReactNode;
  /** In the mark and name's place: the BrandHeader beside the rail, which shows the mark (spec 068 FR-003). */
  lead?: ReactNode;
}

/** Home's brand row: the mark and name, the family on the right; pinned (ScreenHeader README › Brand row). */
export function BrandRow({ brand, avatars, lead }: BrandRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-12">
      {lead ? (
        <View className="min-w-0 flex-1">{lead}</View>
      ) : (
        <View className="flex-row items-center gap-8">
          <Logo size={34} />
          <Text variant="titleSm" style={{ letterSpacing: -0.3 }}>
            {brand}
          </Text>
        </View>
      )}
      {avatars}
    </View>
  );
}

export interface BrandHeaderProps {
  /** "Thursday 16 October". */
  date: string;
  /** "Good evening, Gabriel". */
  greeting: string;
}

/** Home's date and greeting, under the BrandRow (ScreenHeader README › Brand row). */
export function BrandHeader({ date, greeting }: BrandHeaderProps) {
  return (
    <View>
      <Text size={15} weight="700" color="olive">
        {date}
      </Text>
      <Text variant="displayXl" role="heading" aria-level={1}>
        {greeting}
      </Text>
    </View>
  );
}

/** A pushed screen's lead, its first line of content under the TopBar (spec 050 FR-001a). */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <Text size={15} weight="600" color="ink-muted">
      {children}
    </Text>
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
        {/* A row, so Save sits at the far right: Button aligns itself to the start of a column. */}
        <View className="flex-1 flex-row justify-end">
          <Button label={saveLabel} variant="olive" size="sm" onPress={onSave} disabled={saveDisabled} busy={saving} busyLabel={savingLabel} />
        </View>
      </View>
      {progress}
    </View>
  );
}
