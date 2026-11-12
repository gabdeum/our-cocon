import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Button } from './Button';
import { Photo, PhotoPlaceholder } from './Card';
import { Icon } from './Icon';
import { StepBar } from './Progress';
import { Text } from './Text';

export interface CookSessionCardProps {
  /**
   * `list` (OC-Recipes › In progress): the recipe's photo, name, a line and the step bar, the top
   * part opening cooking mode. `page` (OC-Recipe): a pot disc, "Cooking now · step 3 of 6" and a
   * line, as a status.
   */
  variant: 'list' | 'page';
  title: string;
  /** "Step 3 of 6 · Gabriel · since 18:40" (list); "Gabriel started at 18:40 · Classic, serves 6" (page). */
  line: string;
  /** The step bar (list): how many steps, and the current one from 0. */
  steps?: { count: number; current: number };
  /** The recipe's photo (list), peach with its initial when it has none. */
  photoUri?: string;
  /** Screen-reader name of the top part (list): "Resume Leek & bacon quiche, step 3 of 6". */
  openLabel?: string;
  labels: { cancel: string; done: string; resume: string };
  /** Each action's screen-reader name, naming the recipe on the list ("Cancel cooking Leek & bacon quiche"). */
  a11y?: { cancel?: string; done?: string; resume?: string };
  onCancel: () => void;
  onDone: () => void;
  onResume: () => void;
  /** Offline: the actions can't save. */
  disabled?: boolean;
}

/**
 * A recipe being cooked (CookSessionCard README, spec 051): white, honey border, radius 22, then
 * Cancel · Done · Resume (ink, play icon), 1 : 1 : 1.4.
 */
export function CookSessionCard({ variant, title, line, steps, photoUri, openLabel, labels, a11y = {}, onCancel, onDone, onResume, disabled }: CookSessionCardProps) {
  const list = variant === 'list';
  const head = list ? (
    <Pressable role="link" aria-label={openLabel} onPress={onResume} disabled={disabled} className={cn('flex-row items-center gap-12 rounded-[14px]', focusRing)}>
      <View className="h-[60px] w-[60px] overflow-hidden rounded-[14px]">
        {photoUri ? <Photo uri={photoUri} /> : <PhotoPlaceholder className="h-full w-full" />}
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text size={16} weight="900" numberOfLines={2}>
          {title}
        </Text>
        <Text size={13} weight="700" color="ink-muted">
          {line}
        </Text>
        {steps ? (
          <View className="mt-[5px]">
            <StepBar count={steps.count} current={steps.current} />
          </View>
        ) : null}
      </View>
    </Pressable>
  ) : (
    <View role="status" className="flex-row items-center gap-12">
      <View className="h-[40px] w-[40px] items-center justify-center rounded-full bg-honey">
        <Icon name="pot" size={20} color="ink" />
      </View>
      <View className="min-w-0 flex-1">
        <Text size={16} weight="900">
          {title}
        </Text>
        <Text size={13} weight="600" color="ink-muted">
          {line}
        </Text>
      </View>
    </View>
  );
  return (
    <View className={cn('rounded-xl border-2 border-honey bg-surface-card', list ? 'gap-10 p-10' : 'gap-12 p-14')}>
      {head}
      <View className="flex-row gap-8">
        <View className="flex-1">
          <Button label={labels.cancel} aria-label={a11y.cancel} variant="soft" size="sm" block disabled={disabled} onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button label={labels.done} aria-label={a11y.done} variant="soft" size="sm" block disabled={disabled} onPress={onDone} />
        </View>
        <View className="flex-[1.4]">
          <Button label={labels.resume} aria-label={a11y.resume} icon={list ? 'play' : undefined} variant="ink" size="sm" block disabled={disabled} onPress={onResume} />
        </View>
      </View>
    </View>
  );
}
