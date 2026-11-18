import { describe, expect, it } from 'vitest';
import { NEUTRAL_PERFORMANCE_POSITION, getPerformanceMix } from './performance-pad';

describe('XY performance pad', () => {
  it('preserves both layer levels and bypasses the filter at reset', () => {
    expect(getPerformanceMix(NEUTRAL_PERFORMANCE_POSITION, 48000))
      .toMatchObject({levelA: 1, levelB: 1, filterMix: 0});
  });

  it('tapers the opposite layer without boosting the selected one', () => {
    const mixAt = (blend: number) => getPerformanceMix({blend, brightness: 1}, 48000);
    expect(mixAt(0)).toMatchObject({levelA: 1, levelB: 0});
    expect(mixAt(0.25)).toMatchObject({levelA: 1, levelB: 0.5});
    expect(mixAt(0.75)).toMatchObject({levelA: 0.5, levelB: 1});
    expect(mixAt(1)).toMatchObject({levelA: 0, levelB: 1});
  });

  it('controls cutoff independently and rejects invalid coordinates', () => {
    const mixAt = (brightness: number) => getPerformanceMix({blend: 0.5, brightness}, 48000);
    expect(mixAt(0)).toMatchObject({cutoffHz: 120, filterMix: 1});
    expect(mixAt(0.5).cutoffHz).toBeCloseTo(Math.sqrt(120 * 18000));
    expect(mixAt(0.975).filterMix).toBeCloseTo(0.5);
    expect(() => getPerformanceMix({blend: 0.5, brightness: NaN}, 48000)).toThrow();
  });
});
