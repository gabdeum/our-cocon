import { Image, Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export type ThumbTone = 'peach' | 'honey' | 'sage';
const thumbs: Record<ThumbTone, string> = { peach: 'bg-peach', honey: 'bg-honey', sage: 'bg-sage' };

export interface RecipeItemProps {
  name: string;
  /** "1 h 10 · Serves 6 · 2 variants". */
  meta: string;
  /** "Gabriel · via Claude", or just "Mia". */
  author: string;
  photoUri?: string;
  placeholderTone?: ThumbTone;
  onPress: () => void;
}

/**
 * Loading state (RecipeItem README › States; Patterns.md › Loading): surface-soft blocks at the size
 * of the thumbnail, name, meta and author, no spinner. Hidden from screen readers; the list says
 * it is loading.
 */
export function RecipeItemSkeleton() {
  return (
    <View aria-hidden testID="recipe-item-skeleton" className="flex-row items-center gap-14 rounded-xl bg-surface-card p-10">
      <View className="h-[84px] w-[84px] rounded-lg bg-surface-soft" />
      <View className="min-w-0 flex-1 gap-8">
        <View className="h-[18px] w-3/4 rounded-xs bg-surface-soft" />
        <View className="h-[14px] w-1/2 rounded-xs bg-surface-soft" />
        <View className="h-[13px] w-1/3 rounded-xs bg-surface-soft" />
      </View>
    </View>
  );
}

/** A recipe in a list (RecipeItem README): 84 thumbnail, name (2 lines), meta, author. */
export function RecipeItem({ name, meta, author, photoUri, placeholderTone = 'peach', onPress }: RecipeItemProps) {
  return (
    <Pressable role="link" onPress={onPress} className={cn('flex-row items-center gap-14 rounded-xl bg-surface-card p-10 active:bg-surface-card-pressed', focusRing)}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} resizeMode="cover" className="h-[84px] w-[84px] rounded-lg" />
      ) : (
        <View aria-hidden className={cn('h-[84px] w-[84px] rounded-lg', thumbs[placeholderTone])} />
      )}
      <View className="min-w-0 flex-1">
        <Text size={17} weight="900" numberOfLines={2}>
          {name}
        </Text>
        <Text size={14} weight="600" color="ink-muted" className="mt-[2px]">
          {meta}
        </Text>
        <Text size={13} weight="700" color="olive" className="mt-6">
          {author}
        </Text>
      </View>
    </Pressable>
  );
}
