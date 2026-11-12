import { Image, Pressable, View } from 'react-native';
import { useLargeText } from '../a11y';
import { cn, focusRing } from '../cn';
import { Thumb } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';

export type ThumbTone = 'peach' | 'honey' | 'sage';
const thumbs: Record<ThumbTone, string> = { peach: 'bg-peach', honey: 'bg-honey', sage: 'bg-sage' };

export interface RecipeItemProps {
  name: string;
  /** "1 h 10 · Serves 6 · 2 variants". */
  meta: string;
  /** The recipe's source (spec 051 FR-015): "La Cuisine de Mamie · p. 48", "ChatGPT" or "Mia". */
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
  const largeText = useLargeText();
  return (
    <Pressable role="link" onPress={onPress} className={cn('flex-row items-center gap-14 rounded-xl bg-surface-card p-10 active:bg-surface-card-pressed', focusRing)}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} resizeMode="cover" className="h-[84px] w-[84px] rounded-lg" />
      ) : (
        <View aria-hidden className={cn('h-[84px] w-[84px] rounded-lg', thumbs[placeholderTone])} />
      )}
      <View className="min-w-0 flex-1">
        <Text size={17} weight="900" numberOfLines={largeText ? undefined : 2}>
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

export interface RecipeSummaryProps {
  name: string;
  /** "From the Our Cocon family". */
  sub: string;
  photoUri?: string;
  /** The photo's screen-reader name. */
  photoLabel: string;
}

/**
 * A recipe named at the top of a sheet (RecipeItem README › Summary; OC-Share): 64 thumbnail,
 * name and one line under it, on a white card. Not tappable.
 */
export function RecipeSummary({ name, sub, photoUri, photoLabel }: RecipeSummaryProps) {
  const largeText = useLargeText();
  return (
    <View className="flex-row items-center gap-12 rounded-[20px] bg-surface-card p-10">
      {photoUri ? (
        <Image source={{ uri: photoUri }} resizeMode="cover" role="img" aria-label={photoLabel} className="h-[64px] w-[64px] rounded-[14px]" />
      ) : (
        <View aria-hidden className="h-[64px] w-[64px] items-center justify-center rounded-[14px] bg-peach">
          <Text size={22} weight="900" color="peach-ink">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text size={17} weight="900" numberOfLines={largeText ? undefined : 2}>
          {name}
        </Text>
        <Text size={14} weight="600" color="ink-muted">
          {sub}
        </Text>
      </View>
    </View>
  );
}

export interface GroceryRecipeCardProps {
  name: string;
  /** "3 items on the list · serves 6", or "From a deleted recipe". */
  meta: string;
  photoUri?: string;
  /** Screen-reader names: "Open Leek & bacon quiche", "More for Leek & bacon quiche". */
  openLabel: string;
  moreLabel: string;
  /** Null for a recipe in Recently deleted: the body does nothing and shows no chevron. */
  onOpen: (() => void) | null;
  onMore: () => void;
}

/**
 * A recipe on the grocery list (RecipeItem README › Grocery card; OC-Groceries, spec 052 FR-006):
 * soft, radius 18. The body (40 thumbnail, name, meta, chevron) opens the recipe; the 48 × 60 "…"
 * at the right opens its menu.
 */
export function GroceryRecipeCard({ name, meta, photoUri, openLabel, moreLabel, onOpen, onMore }: GroceryRecipeCardProps) {
  const body = (
    <>
      {/* The name is right beside it: the photo isn't read again (spec 030). */}
      <Thumb uri={photoUri} />
      <View className="min-w-0 flex-1">
        <Text size={15} weight="800">
          {name}
        </Text>
        <Text size={13} weight="600" color="ink-muted">
          {meta}
        </Text>
      </View>
      {onOpen ? <Icon name="chevron-right" size={18} color="inkMuted" /> : null}
    </>
  );
  return (
    <View className="flex-row items-center rounded-[18px] bg-surface-soft">
      {onOpen ? (
        <Pressable role="link" aria-label={openLabel} onPress={onOpen} className={cn('min-w-0 flex-1 flex-row items-center gap-10 rounded-[18px] py-10 pl-12 active:bg-surface-soft-pressed', focusRing)}>
          {body}
        </Pressable>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-10 py-10 pl-12">{body}</View>
      )}
      <Pressable role="button" aria-label={moreLabel} onPress={onMore} className={cn('h-[60px] w-[48px] items-center justify-center rounded-[18px] active:bg-surface-soft-pressed', focusRing)}>
        <Icon name="more-vertical" size={22} color="ink" />
      </Pressable>
    </View>
  );
}
