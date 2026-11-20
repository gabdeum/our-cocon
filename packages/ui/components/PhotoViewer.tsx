import { forwardRef, type RefObject } from 'react';
import { Image, Modal, Pressable, View, type HostInstance, type ImageSourcePropType } from 'react-native';
import { useReturnFocus } from '../a11y';
import { cn, focusRing } from '../cn';
import { useReduceMotion } from '../reduceMotion';
import { IconButton } from './IconButton';

export interface StepPhotoProps {
  /** The stored photo: `{ uri }`. */
  source: ImageSourcePropType;
  /** "See the photo for Bake larger". */
  label: string;
  /** 72 on the phone, 96 from 600 (spec 066 FR-004). */
  size: 72 | 96;
  onPress: () => void;
}

/** A step's photo as a small square beside its title in cooking mode (PhotoViewer README); tap to see it larger. */
export const StepPhoto = forwardRef<HostInstance, StepPhotoProps>(function StepPhoto({ source, label, size, onPress }, ref) {
  return (
    <Pressable ref={ref} role="button" aria-label={label} onPress={onPress} className={cn('flex-none overflow-hidden rounded-lg bg-surface-soft', focusRing)} style={{ width: size, height: size }}>
      <Image source={source} resizeMode="cover" aria-hidden className="h-full w-full" />
    </Pressable>
  );
});

export interface PhotoViewerProps {
  /** The photo to show, or null when closed. */
  source: ImageSourcePropType | null;
  /** What the photo shows, for screen readers: "Photo for Bake". */
  label: string;
  /** "Close photo". */
  closeLabel: string;
  onClose: () => void;
  /** The thumbnail that opened it: focus goes back to it on close (spec 030 FR-003). */
  returnFocusRef?: RefObject<HostInstance | null>;
}

/**
 * A photo full screen (PhotoViewer README), whole (contain) on the scrim, with a round ✕ at the top
 * right. Tapping anywhere, Esc or the system back closes it.
 */
export function PhotoViewer({ source, label, closeLabel, onClose, returnFocusRef }: PhotoViewerProps) {
  const reduceMotion = useReduceMotion();
  useReturnFocus(source !== null, returnFocusRef);
  if (source === null) return null;
  return (
    <Modal transparent visible animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View role="dialog" aria-modal aria-label={label} className="flex-1 bg-scrim">
        <Pressable aria-hidden onPress={onClose} className="absolute inset-0 items-center justify-center p-24" tabIndex={-1}>
          <Image source={source} resizeMode="contain" className="h-full w-full" />
        </Pressable>
        <View className="absolute right-16 top-16">
          <IconButton variant="round" icon="close" iconSize={20} label={closeLabel} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
