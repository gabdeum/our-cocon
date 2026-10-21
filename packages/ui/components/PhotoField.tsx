import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import { cn, focusRing } from '../cn';
import { Link } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface PhotoFieldProps {
  /** The photo to show; without it (and not `loading`), the dashed "Add a photo (optional)" button. */
  source?: ImageSourcePropType | null;
  /** A photo is set but not loaded yet: its box and actions show, empty until it arrives. */
  loading?: boolean;
  addLabel: string;
  onAdd: () => void;
  changeLabel: string;
  onChange: () => void;
  removeLabel: string;
  onRemove: () => void;
  /** Read out for the photo itself ("Recipe photo"). */
  photoLabel: string;
  /** While the photo uploads: the photo dimmed, and this under it ("Uploading photo…"). */
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A form's photo (PhotoField README; OC-EditBasics): a dashed 150-tall button with a camera until a
 * photo is added, then the photo in the header's shape (13:8) with "Change photo" and "Remove".
 */
export function PhotoField({
  source,
  loading,
  addLabel,
  onAdd,
  changeLabel,
  onChange,
  removeLabel,
  onRemove,
  photoLabel,
  busyLabel,
  disabled,
  className,
}: PhotoFieldProps) {
  if (!source && !loading) {
    return (
      <Pressable
        role="button"
        aria-label={addLabel}
        onPress={onAdd}
        disabled={disabled}
        className={cn(
          'h-[150px] items-center justify-center gap-8 rounded-[22px] border-2 border-dashed border-line-dashed bg-surface-soft active:opacity-90',
          focusRing,
          className,
        )}
      >
        <Icon name="camera" size={28} color="inkMuted" />
        <Text size={15} weight="800" color="ink-muted">
          {addLabel}
        </Text>
      </Pressable>
    );
  }
  return (
    <View className={cn('gap-6', className)}>
      <View className="overflow-hidden rounded-[22px] bg-surface-soft" style={{ aspectRatio: 13 / 8 }}>
        {source ? (
          <Image source={source} resizeMode="cover" className={cn('h-full w-full', busyLabel ? 'opacity-dimmed' : null)} role="img" aria-label={photoLabel} />
        ) : null}
      </View>
      {busyLabel ? (
        <Text variant="caption" color="ink-muted" role="status">
          {busyLabel}
        </Text>
      ) : null}
      <View className="flex-row gap-16">
        <Link label={changeLabel} onPress={onChange} disabled={disabled || Boolean(busyLabel)} />
        <Link label={removeLabel} tone="danger" onPress={onRemove} disabled={disabled || Boolean(busyLabel)} />
      </View>
    </View>
  );
}
