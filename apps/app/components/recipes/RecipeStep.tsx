import { Callout, StepCard, TimerRow } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { StepLine } from '../../lib/recipe-view';
import { useStepTimerControl, type StepTimerInput } from './step-timer';

const p = strings.recipePage;
const stepCopy = strings.recipePage.steps;

/** One step on the recipe page (spec 009 FR-001) and the shared page (019): text, then the temperature check, the timer row and the tip, in that order. */
export function RecipeStep({
  step,
  index,
  recipeId,
  recipeName,
  tracker,
  photoUri,
}: {
  step: StepLine;
  index: number;
  recipeId: string;
  recipeName: string;
  tracker: Tracker;
  photoUri?: string;
}) {
  return (
    <StepCard
      number={step.number}
      name={step.name ?? undefined}
      variantTag={step.variant ? p.variantTag : undefined}
      parts={step.parts}
      photo={photoUri ? { uri: photoUri, label: p.stepPhoto(step.number) } : undefined}
    >
      {step.tempCheck ? <Callout variant="temp" label={stepCopy.tempLabel} text={step.tempCheck} /> : null}
      {step.timer ? <StepTimer stepId={step.id} index={index} recipeId={recipeId} recipeName={recipeName} timer={step.timer} tracker={tracker} /> : null}
      {step.tip ? <Callout variant="tip" label={stepCopy.tipLabel} text={step.tip} /> : null}
    </StepCard>
  );
}

const rowLabel = { idle: stepCopy.startTimer, running: stepCopy.pause, paused: stepCopy.resume, done: stepCopy.done } as const;

/** A step's timer row (spec 010, 009 US3); the rules are in `useStepTimerControl`. */
function StepTimer(props: StepTimerInput) {
  const t = useStepTimerControl(props);
  return (
    <TimerRow
      state={t.state}
      label={rowLabel[t.state]}
      clock={t.clock}
      onPress={t.onPress}
      minusLabel={stepCopy.minus}
      plusLabel={stepCopy.plus}
      minusA11y={stepCopy.minusA11y}
      plusA11y={stepCopy.plusA11y}
      onMinus={t.onMinus}
      onPlus={t.onPlus}
      announcement={t.announcement}
    />
  );
}
