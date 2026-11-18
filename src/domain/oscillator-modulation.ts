import type { OscillatorSettings } from './drone';
import { getFilterModulationLimits } from './modulation';

export const OSCILLATOR_MODULATION_PARAMETERS = {
  frequency: {label: 'FREQUENCY', unit: 'Hz', minimum: 40, maximum: 880, maximumDepth: 840, defaultDepth: 30, step: 1},
  volume: {label: 'VOLUME', unit: '%', minimum: 0, maximum: 1, maximumDepth: 1, defaultDepth: 0.25, step: 0.01},
  cutoff: {label: 'CUTOFF', unit: 'Hz', minimum: 20, maximum: 20000, maximumDepth: 5000, defaultDepth: 300, step: 1}
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
  return {base, lower: Math.max(Math.min(minimum, base), base - depth), upper: Math.min(Math.max(maximum, base), base + depth)};
}

export function replaceOscillatorModulationRoute(routes: readonly OscillatorModulationRoute[], route: OscillatorModulationRoute) {
  return [...routes.filter(item => item.targetId !== route.targetId || item.parameter !== route.parameter), route];
}

export function createsFrequencyModulationCycle(
  routes: readonly OscillatorModulationRoute[], targetId: string, sourceId: string
): boolean {
  const upstream = new Map(routes.filter(route => route.enabled && route.parameter === 'frequency')
    .map(route => [route.targetId, route.sourceId]));
  const visited = new Set([targetId]);
  for (let current: string | undefined = sourceId; current !== undefined; current = upstream.get(current)) {
    if (visited.has(current)) return true;
    visited.add(current);
  }
  return false;
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
      route.depth > OSCILLATOR_MODULATION_PARAMETERS[route.parameter].maximumDepth) {
      throw new Error('Invalid oscillator modulation route.');
    }
    const destination = `${route.targetId}:${route.parameter}`;
    if (destinations.has(destination)) throw new Error('Each slider allows one oscillator modulation source.');
    destinations.add(destination);
  }
  for (const route of routes) {
    if (route.enabled && route.parameter === 'frequency' &&
      createsFrequencyModulationCycle(routes, route.targetId, route.sourceId)) {
      throw new Error('Frequency modulation cannot form a feedback loop.');
    }
  }
}
