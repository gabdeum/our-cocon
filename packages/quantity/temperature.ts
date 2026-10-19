import { assertAmount } from './errors';
import { toStep } from './round';
import type { UnitSystem } from './types';
import { cToF } from './units';

export interface TemperatureOptions {
  system: UnitSystem;
  /** Ovens read in steps of 25 °F, as recipes print them (180 °C → 350 °F); thermometer checks in steps of 5 (71 °C → 160 °F). */
  kind: 'oven' | 'food';
}

/** FR-005: both scales, the person's first. Stored temperatures are °C. */
export function formatTemperature(celsius: number, options: TemperatureOptions): string {
  if (!Number.isFinite(celsius)) assertAmount(Number.NaN, 'Temperature');
  const c = Math.round(celsius);
  const f = Math.round(toStep(cToF(celsius), options.kind === 'oven' ? 25 : 5));
  return options.system === 'metric' ? `${c} °C (${f} °F)` : `${f} °F (${c} °C)`;
}
