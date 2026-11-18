export interface PerformancePosition {
  readonly blend: number;
  readonly brightness: number;
}

export const NEUTRAL_PERFORMANCE_POSITION: PerformancePosition = {blend: 0.5, brightness: 1};

export function getPerformanceMix(position: PerformancePosition, sampleRate: number) {
  const {blend, brightness} = position;
  if (![blend, brightness].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new Error('XY pad coordinates must be between 0 and 1.');
  }

  const lowestCutoff = 120;
  const highestCutoff = Math.min(18000, sampleRate * 0.4);
  return {
    levelA: Math.min(1, 2 * (1 - blend)),
    levelB: Math.min(1, 2 * blend),
    cutoffHz: lowestCutoff * (highestCutoff / lowestCutoff) ** brightness,
    filterMix: Math.min(1, (1 - brightness) * 20)
  };
}
