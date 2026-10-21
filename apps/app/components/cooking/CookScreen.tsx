import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { AwakeChip, Button, Callout, CookLayout, CookProgress, CookSection, CookTimerCard, PushedScreen, StepText, Text } from '@cocon/ui';
import { MAX_TRACKED_STEPS, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, recipeView, servingsMax, servingsText, type CookingSettings } from '../../lib/recipe-view';
import { cookingMinutes, startIndex } from '../../lib/cooking';
import { useCookAwake, type AwakeStatus as Awake } from '../../lib/keep-awake';
import { AppTimerPill, useHasTimers } from '../timers/AppTimerPill';
import { useStepTimerControl, type StepTimerInput } from '../recipes/step-timer';
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
  /** "I have a thermometer" and "Keep screen on" (spec 027 wires them); on until then. */
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
  const { recipe, storage, userId, exit } = props;
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  useEffect(() => {
    let live = true;
    void readChoices(storage, userId, recipe.id).then((stored) => {
      if (live) setChoices(startingChoices(stored, recipe, servingsMax(recipe.serves)));
    });
    return () => {
      live = false;
    };
    // The recipe page set these; a live edit to the recipe re-validates them below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId, recipe.id]);

  // A variant deleted while cooking no longer counts.
  const current = useMemo(() => (choices ? startingChoices(choices, recipe, servingsMax(recipe.serves)) : null), [choices, recipe]);
  if (!current) return <CookLoading exit={exit} />;
  return <Cooking {...props} choices={current} />;
}

function Cooking({ recipe, choices, tracker, stepId, onClose, onOpenTimers, cooking = defaultCooking, now = Date.now }: LoadedProps & { choices: RecipeChoices }) {
  // The recipe page's units, kitchen scale and scale by an ingredient too (013, 032-later L22).
  const view = useMemo(() => recipeView(recipe, choices, choices, formatOf(choices), cooking), [recipe, choices, cooking]);
  const steps = view.steps;
  const count = steps.length;
  // Events cap step counts (variants can add steps on top of a recipe's 100).
  const sent = (n: number) => Math.min(n, MAX_TRACKED_STEPS);
  const awake = useCookAwake(cooking.keepAwake);
  const hasPill = useHasTimers();

  const scroller = useRef<ScrollView>(null);
  const scrollTo = useCallback((y: number, animated: boolean) => scroller.current?.scrollTo({ y, animated }), []);
  const [initial] = useState(() => startIndex(steps.map((s) => s.id), stepId));
  const { current, onStepLayout, onScroll, jump, tops } = useStepScroll(count, initial, scrollTo);

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

  return (
    <CookLayout
      exitLabel={c.exit}
      onExit={exit}
      status={hasPill ? <AppTimerPill onOpen={onOpenTimers} tracker={tracker} compact /> : <AwakeStatus awake={awake} />}
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
      backLabel={c.back}
      onBack={() => {
        if (at > 0) jump(at - 1);
      }}
      nextLabel={last ? c.finish : c.next}
      onNext={next}
      scrollRef={scroller}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height)}
      snapOffsets={tops}
    >
      {steps.map((step, i) => (
        <CookSection
          key={step.id}
          testID={`cook-step-${i}`}
          title={step.name ?? undefined}
          current={i === at}
          onLayout={(e) => onStepLayout(i, e.nativeEvent.layout.y)}
        >
          <StepText parts={step.parts} cook />
          {step.timer ? <CookTimer stepId={step.id} index={i} recipeId={recipe.id} recipeName={recipe.name} timer={step.timer} tracker={tracker} /> : null}
          {step.tempCheck ? <Callout variant="temp" label={p.steps.tempLabel} text={step.tempCheck} cook /> : null}
          {step.tip ? <Callout variant="tip" label={p.steps.tipLabel} text={step.tip} cook /> : null}
        </CookSection>
      ))}
    </CookLayout>
  );
}

/** With no TimerPill: "Screen stays on", or a muted hint when this browser can't keep it on (OC-Cook › States). */
function AwakeStatus({ awake }: { awake: Awake }) {
  if (awake === 'on') return <AwakeChip label={c.awake} />;
  if (awake === 'off') return null;
  return (
    <Text size={13} weight="700" color="ink-muted" align="right">
      {c.awakeUnsupported}
    </Text>
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
