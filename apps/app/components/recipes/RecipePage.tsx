import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Callout,
  Card,
  Choice,
  IconButton,
  IngredientRow,
  Meta,
  PhotoPlaceholder,
  PhotoScreen,
  PillRow,
  SegmentedControl,
  SettingRow,
  StatusBanner,
  StepCard,
  StepFootnote,
  Stepper,
  Text,
  TimerRow,
} from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, defaultFormat, optionHint, recipeChips, recipeView, servingsMax, SERVINGS_MIN, variantCount, type StepLine } from '../../lib/recipe-view';
import type { Member } from '../../lib/session';
import { useStepTimer, useTimerStore } from '../../lib/timer-store';
import { adjusted, clock, MINUTE } from '../../lib/timers';
import { OfflineBanner } from '../sync/OfflineBanner';

const p = strings.recipePage;
const stepCopy = strings.recipePage.steps;
/** `servings_changed` waits for the stepper to settle, so 6 → 9 in three taps is one change. */
export const SERVINGS_SETTLE_MS = 800;

export type RecipeTab = 'ingredients' | 'steps';

export interface RecipePageProps {
  /** Undefined while loading; null when there's no such recipe for this family. */
  recipe: RecipeDetail | null | undefined;
  /** The load failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
  members: readonly Member[];
  userId: string;
  tracker: Tracker;
  tab: RecipeTab;
  onTabChange: (tab: RecipeTab) => void;
  storage: ChoiceStorage;
  onBack: () => void;
  onShare: () => void;
  onSettings: () => void;
  onAddToGroceries: () => void;
  onStartCooking: () => void;
  /** "I have a thermometer" (spec 027 wires the setting); on until then. */
  thermometer?: boolean;
}

/** The recipe page (spec 008, design/ui/OC-Recipe.md) and its Steps tab (spec 009, OC-RecipeSteps.md). */
export function RecipePage(props: RecipePageProps) {
  const { recipe, failed, onRetry, tracker, onBack } = props;
  const back = <IconButton icon="back" label={p.back} onPress={onBack} />;

  if (recipe === undefined && !failed) {
    return (
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} left={back}>
        <View role="progressbar" aria-label={p.loading} className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PhotoScreen>
    );
  }
  if (!recipe) {
    return (
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} left={back}>
        <OfflineBanner screen="recipe" tracker={tracker} />
        <Text variant="titleLg" role="heading" aria-level={1}>
          {p.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{p.loadFailedBody}</Text>
        {onRetry ? <Button label={p.retry} variant="soft" onPress={onRetry} /> : null}
      </PhotoScreen>
    );
  }
  return <LoadedRecipe {...props} recipe={recipe} />;
}

function LoadedRecipe({
  recipe,
  members,
  userId,
  tracker,
  tab,
  onTabChange,
  storage,
  onBack,
  onShare,
  onSettings,
  onAddToGroceries,
  onStartCooking,
  thermometer = defaultCooking.thermometer,
}: RecipePageProps & { recipe: RecipeDetail }) {
  const max = servingsMax(recipe.serves);
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // FR-006: open with what was picked last time on this device.
  useEffect(() => {
    let live = true;
    void readChoices(storage, userId, recipe.id).then((stored) => {
      if (live) setChoices(startingChoices(stored, recipe, max));
    });
    return () => {
      live = false;
    };
    // Only when another recipe or person opens; live edits are re-validated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId, recipe.id]);

  // A variant deleted while the page is open no longer counts.
  const current = useMemo(() => (choices ? startingChoices(choices, recipe, max) : null), [choices, recipe, max]);
  const view = useMemo(
    () => (current ? recipeView(recipe, current.servings, current, defaultFormat, { thermometer }) : null),
    [recipe, current, thermometer],
  );
  const chips = recipeChips(recipe, members);
  const versions = recipe.variants.filter((v) => v.kind === 'version');
  const options = recipe.variants.filter((v) => v.kind === 'option');

  const update = (next: RecipeChoices) => {
    setChoices(next);
    void writeChoices(storage, userId, recipe.id, next);
  };

  // `servings_changed` once the stepper settles, from where the burst of taps started.
  // Leaving the page before it settles still sends the change.
  const burst = useRef<{ from: number; to: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const sendServings = useCallback(() => {
    const b = burst.current;
    burst.current = null;
    if (!b) return;
    clearTimeout(b.timer);
    if (b.from !== b.to) tracker.track('servings_changed', { from: b.from, to: b.to });
  }, [tracker]);
  useEffect(() => sendServings, [sendServings]);
  const changeServings = (to: number) => {
    if (!current) return;
    const from = burst.current?.from ?? current.servings;
    clearTimeout(burst.current?.timer);
    burst.current = { from, to, timer: setTimeout(() => sendServings(), SERVINGS_SETTLE_MS) };
    update({ ...current, servings: to });
  };

  const pickVariants = (next: RecipeChoices) => {
    if (!current || (next.version === current.version && next.options.length === current.options.length && next.options.every((id) => current.options.includes(id)))) return;
    tracker.track('variant_selected', { variant_count: variantCount(next) });
    update(next);
  };

  const deletedBy = recipe.deleted_at ? (members.find((m) => m.user_id === recipe.deleted_by)?.display_name ?? strings.recipe.formerMember) : null;

  return (
    <PhotoScreen
      photo={<PhotoPlaceholder initial={recipe.name.charAt(0).toUpperCase()} className="h-full" />}
      left={<IconButton icon="back" label={p.back} onPress={onBack} />}
      right={
        <>
          <IconButton icon="share" label={p.share} onPress={onShare} />
          <IconButton icon="settings" label={p.settings} onPress={onSettings} />
        </>
      }
      banner={
        <>
          <OfflineBanner screen="recipe" tracker={tracker} />
          {deletedBy ? <StatusBanner tone="warn" message={p.deleted(deletedBy)} actionLabel={p.back} onAction={onBack} /> : null}
        </>
      }
    >
      <View>
        <Text variant="displayLg" role="heading" aria-level={1}>
          {recipe.name}
        </Text>
        {recipe.description ? (
          <Text variant="body" color="ink-muted" className="mt-6">
            {recipe.description}
          </Text>
        ) : null}
        <PillRow className="mt-12">
          {chips.facts.map((chip) => (
            <Meta key={chip} label={chip} />
          ))}
          <Meta label={chips.author} tone="sage" />
        </PillRow>
      </View>

      {recipe.variants.length > 0 && current ? (
        <View className="gap-10">
          <Text size={16} weight="900" role="heading" aria-level={2}>
            {p.version}
          </Text>
          {versions.length > 0 ? (
            <PillRow>
              <Choice label={p.classic} selected={current.version === null} onPress={() => pickVariants({ ...current, version: null })} />
              {versions.map((v) => (
                <Choice key={v.id} label={v.name} selected={current.version === v.id} onPress={() => pickVariants({ ...current, version: v.id })} />
              ))}
            </PillRow>
          ) : null}
          {options.map((v) => {
            const on = current.options.includes(v.id);
            return (
              <SettingRow
                key={v.id}
                boxed
                label={v.name}
                hint={optionHint(v) ?? undefined}
                value={on}
                onValueChange={(next) => pickVariants({ ...current, options: next ? [...current.options, v.id] : current.options.filter((id) => id !== v.id) })}
              />
            );
          })}
        </View>
      ) : null}

      <Card className="py-12 pl-16 pr-12">
        <View className="flex-row items-center gap-8">
          <Text size={17} weight="900" className="flex-1">
            {p.servings}
          </Text>
          {current ? (
            <Stepper value={current.servings} onChange={changeServings} min={SERVINGS_MIN} max={max} decreaseLabel={p.fewerServings} increaseLabel={p.moreServings} />
          ) : null}
          {/* The panel under it is spec 013. */}
          <IconButton icon="more" label={p.moreOptions} variant="square" iconSize={22} expanded={moreOpen} onPress={() => setMoreOpen((o) => !o)} className="ml-4" />
        </View>
      </Card>

      {view ? (
        <>
          <SegmentedControl
            variant="tabs"
            label={p.tabsLabel}
            value={tab}
            onChange={onTabChange}
            segments={[
              { key: 'ingredients', label: p.ingredientsTab(view.ingredients.length) },
              { key: 'steps', label: p.stepsTab(view.stepCount) },
            ]}
          />
          {tab === 'ingredients' ? (
            <View>
              <View role="list" aria-label={p.ingredientsLabel}>
                {view.ingredients.map((ing, i) => (
                  <IngredientRow
                    key={ing.id}
                    amount={ing.amount}
                    name={ing.name}
                    sub={ing.sub ?? undefined}
                    tag={ing.variant ? { label: p.variantTag, tone: 'sage' } : undefined}
                    last={i === view.ingredients.length - 1}
                  />
                ))}
              </View>
              <Button label={p.addToGroceries} variant="outline" icon="groceries" block onPress={onAddToGroceries} className="mt-16" />
            </View>
          ) : (
            <View className="gap-14">
              <View role="list" aria-label={p.stepsLabel} className="gap-14">
                {view.steps.map((step, index) => (
                  <View key={step.id} role="listitem">
                    <Step step={step} index={index} recipeId={recipe.id} tracker={tracker} />
                  </View>
                ))}
              </View>
              <StepFootnote text={stepCopy.footnote} />
            </View>
          )}
        </>
      ) : null}

      <Button label={p.startCooking} variant="ink" size="lg" icon="play" block onPress={onStartCooking} />
    </PhotoScreen>
  );
}

/** One step (FR-001): text, then the temperature check, the timer row and the tip, in that order. */
function Step({ step, index, recipeId, tracker }: { step: StepLine; index: number; recipeId: string; tracker: Tracker }) {
  return (
    <StepCard number={step.number} name={step.name ?? undefined} variantTag={step.variant ? p.variantTag : undefined} parts={step.parts}>
      {step.tempCheck ? <Callout variant="temp" label={stepCopy.tempLabel} text={step.tempCheck} /> : null}
      {step.timer ? <StepTimer stepId={step.id} index={index} recipeId={recipeId} timer={step.timer} tracker={tracker} /> : null}
      {step.tip ? <Callout variant="tip" label={stepCopy.tipLabel} text={step.tip} /> : null}
    </StepCard>
  );
}

const rowLabel = { running: stepCopy.pause, paused: stepCopy.resume, done: stepCopy.done } as const;

/**
 * A step's timer (spec 010, 009 US3): Start timer → Pause (olive, live clock) → Resume, and "Done!"
 * at 00:00, which dismisses it. −1 / +1 change it even while it runs; before it starts they change
 * only the time it will start with, on this row.
 */
function StepTimer({ stepId, index, recipeId, timer: planned, tracker }: { stepId: string; index: number; recipeId: string; timer: NonNullable<StepLine['timer']>; tracker: Tracker }) {
  const store = useTimerStore();
  const { timer, left } = useStepTimer(recipeId, stepId);
  // A changed recipe (a variant, an edit) starts over from its own time.
  const [chosen, setChosen] = useState({ planned: planned.seconds, seconds: planned.seconds });
  const startWith = chosen.planned === planned.seconds ? chosen.seconds : planned.seconds;
  const setStartWith = (seconds: number) => setChosen({ planned: planned.seconds, seconds });

  const onPress = () => {
    if (!timer) {
      store.start(planned.label, startWith, 'step', { recipeId, stepId });
      tracker.track('step_timer_started', { step_index: index });
      setStartWith(planned.seconds);
    } else if (timer.state === 'running') store.pause(timer.id);
    else if (timer.state === 'paused') store.resume(timer.id);
    else store.dismiss(timer.id);
  };
  const adjust = (delta: number) => () => {
    if (timer) store.add(timer.id, delta);
    else setStartWith(adjusted(startWith, delta));
  };
  const announcement = !timer ? undefined : timer.state === 'done' ? strings.timers.done(timer.label) : timer.state === 'running' && left === MINUTE ? stepCopy.oneMinuteLeft : undefined;

  return (
    <TimerRow
      state={timer ? timer.state : 'idle'}
      label={timer ? rowLabel[timer.state] : stepCopy.startTimer}
      clock={clock(timer ? left : startWith)}
      onPress={onPress}
      minusLabel={stepCopy.minus}
      plusLabel={stepCopy.plus}
      minusA11y={stepCopy.minusA11y}
      plusA11y={stepCopy.plusA11y}
      onMinus={adjust(-MINUTE)}
      onPlus={adjust(MINUTE)}
      announcement={announcement}
    />
  );
}
