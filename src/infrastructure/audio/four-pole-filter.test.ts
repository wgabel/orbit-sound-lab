import { describe, expect, it } from 'vitest';
import { mapResonanceToStageQ } from './web-audio-drone';

/** For two identical second-order low-pass stages, their transfer magnitudes multiply. */
function cascadedLowPassMagnitude(frequencyRatio: number, resonance: number): number {
  const stageQ = mapResonanceToStageQ(resonance);
  const denominatorSquared = (1 - frequencyRatio ** 2) ** 2 + (frequencyRatio / stageQ) ** 2;
  return 1 / denominatorSquared;
}
describe('four-pole low-pass response', () => {
  it('attenuates high frequencies at approximately 24 dB per octave', () => {
    const atTenTimesCutoff = cascadedLowPassMagnitude(10, 0.7);
    const atTwentyTimesCutoff = cascadedLowPassMagnitude(20, 0.7);
    const attenuationDecibels = 20 * Math.log10(atTwentyTimesCutoff / atTenTimesCutoff);
    expect(attenuationDecibels).toBeLessThan(-23);
    expect(attenuationDecibels).toBeGreaterThan(-25);
  });
  it('increases the resonance peak near cutoff', () => {
    expect(cascadedLowPassMagnitude(1, 8)).toBeGreaterThan(cascadedLowPassMagnitude(1, 0.7) * 5);
  });
  it('maps Q across stages without applying full UI Q twice', () => {
    expect(mapResonanceToStageQ(0.7)).toBeCloseTo(Math.sqrt(0.7));
    expect(mapResonanceToStageQ(12)).toBeLessThan(4);
  });
});
