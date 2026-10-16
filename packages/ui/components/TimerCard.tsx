import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

interface Adjust {
  minusLabel: string;
  plusLabel: string;
  minusA11y: string;
  plusA11y: string;
  onMinus: () => void;
  onPlus: () => void;
}

/** A 48 circle under the "white at 70%" look: a 70% white layer, so it follows the theme. */
function SoftWhite({ className, children }: { className: string; children?: ReactNode }) {
  return (
    <View className={cn('overflow-hidden', className)}>
      <View aria-hidden className="absolute inset-0 bg-surface-card opacity-[0.7]" />
      {children}
    </View>
  );
}

export interface CookTimerCardProps extends Adjust {
  /** "Blind bake timer". */
  label: string;
  clock: string;
  /** "Start timer" · "Pause" · "Resume" · "Done". */
  actionLabel: string;
  onAction: () => void;
}

/** The dark timer inside a cooking-mode step (TimerCard README › Dark). Logic comes with spec 010. */
export function CookTimerCard({ label, clock, actionLabel, onAction, ...adj }: CookTimerCardProps) {
  return (
    <View className="gap-10 rounded-[26px] bg-ink px-16 py-14">
      <Text size={14} weight="700" color="on-ink">
        {label}
      </Text>
      <View className="flex-row items-center gap-8">
        <AdjustButton dark text={adj.minusLabel} a11y={adj.minusA11y} onPress={adj.onMinus} />
        <Text variant="timer" color="surface-page" tabular align="center" className="flex-1" role="timer">
          {clock}
        </Text>
        <AdjustButton dark text={adj.plusLabel} a11y={adj.plusA11y} onPress={adj.onPlus} />
      </View>
      <Pressable role="button" onPress={onAction} className={cn('h-control-lg items-center justify-center rounded-pill bg-honey active:bg-honey-pressed', focusRing)}>
        <Text size={18} weight="900">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function AdjustButton({ text, a11y, onPress, dark }: { text: string; a11y: string; onPress: () => void; dark?: boolean }) {
  const inner = (
    <Text size={15} weight="900" color={dark ? 'surface-page' : 'ink'}>
      {text}
    </Text>
  );
  return (
    <Pressable role="button" aria-label={a11y} onPress={onPress} className={cn('h-[48px] w-[48px] rounded-full', focusRing)}>
      {dark ? (
        <View className="h-full w-full items-center justify-center rounded-full bg-ink-raised">{inner}</View>
      ) : (
        <SoftWhite className="h-full w-full items-center justify-center rounded-full">{inner}</SoftWhite>
      )}
    </Pressable>
  );
}

export type TimersScreenState = 'running' | 'paused' | 'done';

export interface TimerCardProps extends Adjust {
  name: string;
  /** "Leek & bacon quiche · Running". */
  sub: string;
  state: TimersScreenState;
  clock: string;
  /** 0–1 of the time elapsed. */
  progress: number;
  /** "Pause" · "Resume" · "Add 1 more minute". */
  actionLabel: string;
  onAction: () => void;
  /** "Stop" or "Dismiss". */
  secondaryLabel: string;
  onSecondary: () => void;
  editLabel: string;
  editing: boolean;
  onEdit: () => void;
  /** "5 min" · "10 min" · "15 min" · "30 min". */
  presets: { label: string; onPress: () => void }[];
}

const fills: Record<TimersScreenState, string> = {
  running: 'bg-sage',
  paused: 'bg-surface-soft',
  done: 'bg-honey border-2 border-ink',
};

/** A timer on the Timers screen, tinted by state (TimerCard README › Timers screen). */
export function TimerCard(props: TimerCardProps) {
  const { name, sub, state, clock, progress, actionLabel, onAction, secondaryLabel, onSecondary, editLabel, editing, onEdit, presets } = props;
  return (
    <View className={cn('gap-12 rounded-[24px] px-16 py-14', fills[state])}>
      <View className="flex-row items-start gap-8">
        <View className="min-w-0 flex-1">
          <Text size={17} weight="900">
            {name}
          </Text>
          <Text size={13} weight="700">
            {sub}
          </Text>
        </View>
        <Pressable role="button" aria-expanded={editing} onPress={onEdit} className={cn('rounded-pill', focusRing)}>
          <SoftWhite className="h-[36px] items-center justify-center rounded-pill px-14">
            <Text size={14} weight="800">
              {editLabel}
            </Text>
          </SoftWhite>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-8">
        <AdjustButton text={props.minusLabel} a11y={props.minusA11y} onPress={props.onMinus} />
        <Text size={44} weight="900" tabular align="center" className="flex-1" role="timer" style={{ letterSpacing: -1, lineHeight: 44 }}>
          {clock}
        </Text>
        <AdjustButton text={props.plusLabel} a11y={props.plusA11y} onPress={props.onPlus} />
      </View>
      <View role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-6 overflow-hidden rounded-[3px]">
        <View aria-hidden className="absolute inset-0 bg-ink opacity-[0.12]" />
        <View className="h-full bg-ink" style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
      </View>
      {editing ? (
        <View className="flex-row gap-6">
          {presets.map((p) => (
            <Pressable key={p.label} role="button" onPress={p.onPress} className={cn('h-control-md flex-1 items-center justify-center rounded-md bg-surface-card', focusRing)}>
              <Text size={15} weight="800">
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="flex-row gap-10">
        <Pressable role="button" onPress={onAction} className={cn('h-[50px] flex-1 items-center justify-center rounded-pill bg-ink active:bg-ink-pressed', focusRing)}>
          <Text size={16} weight="900" color="on-olive">
            {actionLabel}
          </Text>
        </Pressable>
        <Pressable role="button" onPress={onSecondary} className={cn('h-[50px] items-center justify-center rounded-pill bg-surface-soft px-18 active:bg-surface-soft-pressed', focusRing)}>
          <Text size={15} weight="800">
            {secondaryLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
