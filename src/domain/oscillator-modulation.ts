import type { OscillatorSettings } from './drone';
import { AMPLITUDE_LFO_CENTER, getFilterModulationLimits } from './modulation';

export const OSCILLATOR_MODULATION_PARAMETERS = {
  frequency: {label: 'FREQUENCY', unit: 'Hz', minimum: 40, maximum: 880, step: 1},
  volume: {label: 'VOLUME', unit: '%', minimum: 0, maximum: 1, step: 0.01},
  cutoff: {label: 'CUTOFF', unit: 'Hz', minimum: 20, maximum: 20000, step: 1}
} as const;

export type OscillatorModulationParameter = keyof typeof OSCILLATOR_MODULATION_PARAMETERS;

export interface OscillatorModulationRoute {
  readonly targetId: string;
  readonly parameter: OscillatorModulationParameter;
  readonly sourceId: string;
  readonly enabled: boolean;
  readonly depth: number;
}

export function getOscillatorModulationRange(
  oscillator: OscillatorSettings, parameter: OscillatorModulationParameter, depth: number, sampleRate = 48000
) {
  const base = parameter === 'frequency' ? oscillator.frequencyHz :
    parameter === 'volume' ? oscillator.volume : oscillator.filter.cutoffHz;
  const {minimum, maximum} = parameter === 'cutoff' ? getFilterModulationLimits(base, sampleRate) :
    OSCILLATOR_MODULATION_PARAMETERS[parameter];
  return {
    base,
    lower: Math.max(Math.min(minimum, base), base - depth),
    upper: Math.min(Math.max(maximum, base), base + depth)
  };
}

export function getAmplitudeModulationRange(lowerVolume: number, upperVolume: number, depth: number): readonly [number, number] {
  return [lowerVolume * (AMPLITUDE_LFO_CENTER - depth), upperVolume * (AMPLITUDE_LFO_CENTER + depth)];
}

export function replaceOscillatorModulationRoute(routes: readonly OscillatorModulationRoute[], route: OscillatorModulationRoute) {
  return [...routes.filter(item => item.targetId !== route.targetId || item.parameter !== route.parameter), route];
}

export function getOscillatorSliderSpan(parameter: OscillatorModulationParameter): number {
  const {minimum, maximum} = OSCILLATOR_MODULATION_PARAMETERS[parameter];
  return maximum - minimum;
}

export function validateOscillatorModulationRoutes(
  routes: readonly OscillatorModulationRoute[], oscillators: readonly OscillatorSettings[]
): void {
  const candidates: unknown = routes;
  if (!Array.isArray(candidates)) throw new Error('Invalid oscillator modulation routes.');
  const ids = new Set(oscillators.map(oscillator => oscillator.id));
  const destinations = new Set<string>();
  for (const route of routes) {
    if (!route || !Object.hasOwn(OSCILLATOR_MODULATION_PARAMETERS, route.parameter) ||
      !ids.has(route.sourceId) || !ids.has(route.targetId) || route.sourceId === route.targetId ||
      typeof route.enabled !== 'boolean' || !Number.isFinite(route.depth) || route.depth < 0 ||
      route.depth > getOscillatorSliderSpan(route.parameter)) {
      throw new Error('Invalid oscillator modulation route.');
    }
    const destination = `${route.targetId}:${route.parameter}`;
    if (destinations.has(destination)) throw new Error('Each slider allows one oscillator modulation source.');
    destinations.add(destination);
  }
}
