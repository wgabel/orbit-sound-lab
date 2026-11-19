import type { DroneSettings } from './drone';
import { usesWaveformFrequency } from './oscillator-modulation';

export const STEP_TARGET_LABELS = {volume: 'Volume', cutoff: 'Cutoff', frequencyDepth: 'FM Depth'} as const;
export const MAX_STEP_SECONDS = 600;

export interface StepTarget {
  readonly oscillatorId: string;
  readonly parameter: keyof typeof STEP_TARGET_LABELS;
}

export interface StepValue extends StepTarget {
  readonly value: number;
}

export interface OscillatorStep {
  readonly values: readonly StepValue[];
  readonly glideSeconds: number;
  readonly holdSeconds: number;
}

interface StepGlide extends StepValue {
  readonly from: number;
}

export function createOscillatorStep(): OscillatorStep {
  return {values: [], glideSeconds: 8, holdSeconds: 12};
}

export function hasValidStepTimes(step: OscillatorStep): boolean {
  return [step.glideSeconds, step.holdSeconds].every(seconds => seconds >= 0 && seconds <= MAX_STEP_SECONDS);
}

function isFrequencyDepthTarget(target: StepTarget, route: NonNullable<DroneSettings['oscillatorModulations']>[number]) {
  return route.enabled && route.targetId === target.oscillatorId && usesWaveformFrequency(route);
}

export function readStepValue(drone: DroneSettings, target: StepTarget): number | undefined {
  const oscillator = drone.oscillators.find(item => item.id === target.oscillatorId);
  if (!oscillator) return undefined;
  if (target.parameter === 'volume') return oscillator.volume;
  if (target.parameter === 'cutoff') return oscillator.filter.enabled ? oscillator.filter.cutoffHz : undefined;
  return drone.oscillatorModulations?.find(route => isFrequencyDepthTarget(target, route))?.depth;
}

export function applyStepValues(drone: DroneSettings, values: readonly StepValue[]): DroneSettings {
  let oscillators = drone.oscillators;
  let oscillatorModulations = drone.oscillatorModulations;
  for (const target of values) {
    if (readStepValue(drone, target) === undefined) throw new Error('A captured oscillator control is unavailable.');
    const {oscillatorId, parameter, value} = target;
    if (parameter === 'frequencyDepth') {
      oscillatorModulations = oscillatorModulations?.map(route =>
        isFrequencyDepthTarget(target, route) && route.depth !== value ? {...route, depth: value} : route);
    } else {
      oscillators = oscillators.map(oscillator => {
        if (oscillator.id !== oscillatorId) return oscillator;
        if (parameter === 'volume') return oscillator.volume === value ? oscillator : {...oscillator, volume: value};
        return oscillator.filter.cutoffHz === value ? oscillator : {...oscillator, filter: {...oscillator.filter, cutoffHz: value}};
      });
    }
  }
  const changed = oscillators.some((oscillator, index) => oscillator !== drone.oscillators[index]) ||
    oscillatorModulations?.some((route, index) => route !== drone.oscillatorModulations?.[index]);
  return changed ? {...drone, oscillators, oscillatorModulations} : drone;
}

export function prepareStepGlide(drone: DroneSettings, step: OscillatorStep): readonly StepGlide[] {
  return step.values.map(target => {
    const from = readStepValue(drone, target);
    if (from === undefined) throw new Error('A captured oscillator control is unavailable.');
    return {...target, from};
  });
}

export function getStepGlideValues(glide: readonly StepGlide[], elapsedSeconds: number, glideSeconds: number): readonly StepValue[] {
  const progress = glideSeconds === 0 ? 1 : Math.min(1, Math.max(0, elapsedSeconds / glideSeconds));
  return glide.map(({from, value, ...target}) => ({
    ...target,
    value: progress === 1 ? value : Number((from + (value - from) * progress).toFixed(6))
  }));
}
