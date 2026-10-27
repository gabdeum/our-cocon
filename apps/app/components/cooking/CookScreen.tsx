import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { BottomSheet, Button, Callout, CookLayout, CookProgress, CookSection, CookTimerCard, PushedScreen, SettingRow, StepText, Text } from '@cocon/ui';
import { MAX_TRACKED_STEPS, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, recipeView, servingsMax, servingsText, type CookingSettings } from '../../lib/recipe-view';
import { cookingMinutes, startIndex } from '../../lib/cooking';
import { useCookAwake } from '../../lib/keep-awake';
import { AppTimerPill, useHasTimers } from '../timers/AppTimerPill';
import { useStepTimerControl, type StepTimerInput } from '../recipes/step-timer';
import { MoreOptions } from '../recipes/MoreOptions';
import { useStepScroll } from './use-step-scroll';

const c = strings.cook;
const p = strings.recipePage;

export interface CookScreenProps {
  /** `undefined` while loading, `null` when there's no such recipe. */
  recipe: RecipeDetail | null | undefined;
  /** The load failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
  /** Whose servings and variants to cook with (the recipe page's, on this device). */
  userId: string;
  storage: ChoiceStorage;
  tracker: Tracker;
  /** Open at this step (a step timer's "Go to step", 032-later L19); unknown ids open at step 1. */
  stepId?: string;
  /** Exit and Finish both close cooking mode and return to the recipe. */
  onClose: () => void;
  /** The TimerPill opens the Timers screen. */
  onOpenTimers: () => void;
  /** The options sheet's Scale by an ingredient and Unit converter (spec 013). */
  onScaleByIngredient: () => void;
  onConvert: () => void;
  /** Changes when the screen is shown again, so choices a sheet saved are read back. */
  visit?: number;
  /** The recipe's settings in force (spec 027): units, kitchen scale, thermometer checks and "Keep screen on". */
  cooking?: CookingSettings;
  now?: () => number;
}

/** Cooking mode (spec 012, design/ui/OC-Cook.md): one scrolling column of steps, Back and Next. */
export function CookScreen(props: CookScreenProps) {
  const { recipe, failed, onRetry, onClose } = props;
  const exit = <Button label={c.exit} variant="soft" size="sm" icon="close" onPress={onClose} />;

  if (recipe === undefined && !failed) return <CookLoading exit={exit} />;
  // A recipe deleted while open can't be cooked from (OC-Cook › Couldn't load).
  if (!recipe || recipe.deleted_at) {
    return (
      <PushedScreen>
        {exit}
        <Text variant="titleLg" role="heading" aria-level={1}>
          {p.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{p.loadFailedBody}</Text>
        {onRetry && !recipe ? <Button label={p.retry} variant="soft" onPress={onRetry} /> : null}
      </PushedScreen>
    );
  }
  return <WithChoices {...props} recipe={recipe} exit={exit} />;
}

function CookLoading({ exit }: { exit: ReactNode }) {
  return (
    <PushedScreen>
      {exit}
      <View role="progressbar" aria-label={c.loading} className="gap-12">
        <View className="h-8 rounded-xs bg-surface-soft" />
        <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
        {[0, 1, 2].map((n) => (
          <View key={n} className="h-control-md rounded-md bg-surface-soft" />
        ))}
      </View>
    </PushedScreen>
  );
}

type LoadedProps = CookScreenProps & { recipe: RecipeDetail; exit: ReactNode };

/** The recipe page's current servings and variants on this device (spec 008 FR-006), then the steps. */
function WithChoices(props: LoadedProps) {
  const { recipe, storage, userId, exit, visit = 0 } = props;
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  useEffect(() => {
    let live = true;
    void readChoices(storage, userId, recipe.id).then((stored) => {
      if (live) setChoices(startingChoices(stored, recipe, servingsMax(recipe.serves)));
    });
    return () => {
      live = false;
    };
    // The recipe page set these, or a sheet opened from the options; a live edit to the recipe re-validates them below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId, recipe.id, visit]);

  // A variant deleted while cooking no longer counts.
  const current = useMemo(() => (choices ? startingChoices(choices, recipe, servingsMax(recipe.serves)) : null), [choices, recipe]);
  if (!current) return <CookLoading exit={exit} />;
  const update = (next: RecipeChoices) => {
    setChoices(next);
    void writeChoices(storage, userId, recipe.id, next);
  };
  return <Cooking {...props} choices={current} onChoices={update} />;
}

function Cooking({
  recipe,
  choices,
  onChoices,
  tracker,
  stepId,
  onClose,
  onOpenTimers,
  onScaleByIngredient,
  onConvert,
  cooking = defaultCooking,
  now = Date.now,
}: LoadedProps & { choices: RecipeChoices; onChoices: (next: RecipeChoices) => void }) {
  // The recipe page's units, kitchen scale and scale by an ingredient too (013, 032-later L22).
  const view = useMemo(() => recipeView(recipe, choices, choices, formatOf(choices, cooking), cooking), [recipe, choices, cooking]);
  const steps = view.steps;
  const count = steps.length;
  // Events cap step counts (variants can add steps on top of a recipe's 100).
  const sent = (n: number) => Math.min(n, MAX_TRACKED_STEPS);
  // "Screen stays on" in the options sheet, for this visit; it starts from the setting (spec 027).
  const [keepAwake, setKeepAwake] = useState(cooking.keepAwake);
  // The setting can arrive after the recipe (the family's load) or change live: follow it.
  const [awakeSetting, setAwakeSetting] = useState(cooking.keepAwake);
  if (awakeSetting !== cooking.keepAwake) {
    setAwakeSetting(cooking.keepAwake);
    setKeepAwake(cooking.keepAwake);
  }
  const awake = useCookAwake(keepAwake);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const hasPill = useHasTimers();

  const scroller = useRef<ScrollView>(null);
  const scrollTo = useCallback((y: number, animated: boolean) => scroller.current?.scrollTo({ y, animated }), []);
  const [initial] = useState(() => startIndex(steps.map((s) => s.id), stepId));
  const { current, onStepLayout, onViewport, onScroll, jump, snaps, tall } = useStepScroll(count, initial, scrollTo);

  // Once per visit; `minutes` counts from here.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (startedAt.current !== null || count === 0) return;
    startedAt.current = now();
    tracker.track('cooking_started', { step_count: sent(count) });
  }, [count, now, tracker]);

  const at = Math.min(current, Math.max(count - 1, 0));
  const last = at === count - 1;

  // Closes once, whatever re-renders meanwhile. Leaving any other way (the system or browser back)
  // still counts as exiting, at the step it was on.
  const closed = useRef(false);
  const exitedAt = useRef({ at, count });
  useEffect(() => {
    exitedAt.current = { at, count };
  }, [at, count]);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }, [onClose]);
  useEffect(
    () => () => {
      const { at: step, count: total } = exitedAt.current;
      if (!closed.current && total > 0) tracker.track('cooking_exited', { at_step: Math.min(step + 1, MAX_TRACKED_STEPS), step_count: Math.min(total, MAX_TRACKED_STEPS) });
    },
    [tracker],
  );

  // Nothing to cook: straight back to the recipe.
  useEffect(() => {
    if (count === 0) close();
  }, [count, close]);
  if (count === 0) return null;

  const exit = () => {
    if (closed.current) return;
    tracker.track('cooking_exited', { at_step: sent(at + 1), step_count: sent(count) });
    close();
  };
  // Finish just closes, with no prompt (decision 21).
  const next = () => {
    if (!last) return jump(at + 1);
    if (closed.current) return;
    tracker.track('cooking_finished', { step_count: sent(count), minutes: cookingMinutes(startedAt.current ?? now(), now()) });
    close();
  };

  // The options' sheets open over cooking mode and come back to it.
  const openSheet = (open: () => void) => () => {
    setOptionsOpen(false);
    open();
  };

  return (
    <>
    <CookLayout
      exitLabel={c.exit}
      onExit={exit}
      status={hasPill ? <AppTimerPill onOpen={onOpenTimers} tracker={tracker} compact /> : null}
      optionsLabel={c.options}
      onOptions={() => setOptionsOpen(true)}
      progress={
        <CookProgress
          count={count}
          current={at}
          onSelect={jump}
          stepLabel={c.stepOf(at + 1, count)}
          hint={c.hint(servingsText(view.servings))}
          segmentLabel={(i) => c.segment(i + 1, steps[i]?.name ?? null)}
        />
      }
      endLabel={c.bonAppetit}
      // On the first step, Back leaves cooking mode, as Exit does.
      backLabel={at === 0 ? c.exit : c.back}
      backExits={at === 0}
      onBack={() => (at > 0 ? jump(at - 1) : exit())}
      nextLabel={last ? c.finish : c.next}
      nextFinishes={last}
      onNext={next}
      scrollRef={scroller}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height)}
      onViewportLayout={onViewport}
      snapOffsets={snaps}
    >
      {steps.map((step, i) => (
        <CookSection
          key={step.id}
          testID={`cook-step-${i}`}
          title={step.name ?? undefined}
          current={i === at}
          onLayout={(e) => onStepLayout(i, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
          snapEnd={tall[i]}
        >
          <StepText parts={step.parts} cook />
          {step.timer ? <CookTimer stepId={step.id} index={i} recipeId={recipe.id} recipeName={recipe.name} timer={step.timer} tracker={tracker} /> : null}
          {step.tempCheck ? <Callout variant="temp" label={p.steps.tempLabel} text={step.tempCheck} cook /> : null}
          {step.tip ? <Callout variant="tip" label={p.steps.tipLabel} text={step.tip} cook /> : null}
        </CookSection>
      ))}
    </CookLayout>
    {/* Mounted only while open (a closed react-native-web Modal can still catch taps). */}
    {optionsOpen ? (
      <BottomSheet
        visible
        onClose={() => setOptionsOpen(false)}
        title={c.options}
        closeLabel={c.closeOptions}
      >
        <SettingRow
          label={c.awake}
          hint={awake === 'unsupported' ? c.awakeUnsupported : keepAwake ? c.awakeOnHint : c.awakeOffHint}
          value={keepAwake}
          onValueChange={(on) => {
            setKeepAwake(on);
            tracker.track('cook_screen_awake_toggled', { on });
          }}
        />
        <MoreOptions choices={choices} settings={cooking} tracker={tracker} onChange={onChoices} onScaleByIngredient={openSheet(onScaleByIngredient)} onConvert={openSheet(onConvert)} />
      </BottomSheet>
    ) : null}
    </>
  );
}

const actionLabel = { idle: c.startTimer, running: c.pause, paused: c.resume, done: c.done } as const;

function CookTimer(props: StepTimerInput) {
  const t = useStepTimerControl(props);
  const copy = strings.recipePage.steps;
  return (
    <CookTimerCard
      label={c.timerLabel(props.timer.label)}
      clock={t.clock}
      actionLabel={actionLabel[t.state]}
      onAction={t.onPress}
      minusLabel={copy.minus}
      plusLabel={copy.plus}
      minusA11y={copy.minusA11y}
      plusA11y={copy.plusA11y}
      onMinus={t.onMinus}
      onPlus={t.onPlus}
      announcement={t.announcement}
    />
  );
}
