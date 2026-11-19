import { describe, expect, it } from 'vitest';
import { getMorphAutomationProgress, validateMorphAutomation } from './morph-automation';

describe('morph automation', () => {
  it('moves from A to B and holds the endpoint', () => {
    const settings = {durationSeconds: 10, loop: false};
    expect(getMorphAutomationProgress(settings, -1)).toEqual({position: 0, running: true});
    expect(getMorphAutomationProgress(settings, 5)).toEqual({position: 0.5, running: true});
    expect(getMorphAutomationProgress(settings, 10)).toEqual({position: 1, running: false});
    expect(getMorphAutomationProgress(settings, 20)).toEqual({position: 1, running: false});
  });

  it('uses the same travel time for both legs and keeps looping', () => {
    const settings = {durationSeconds: 10, loop: true};
    expect(getMorphAutomationProgress(settings, 10)).toEqual({position: 1, running: true});
    expect(getMorphAutomationProgress(settings, 15)).toEqual({position: 0.5, running: true});
    expect(getMorphAutomationProgress(settings, 20)).toEqual({position: 0, running: true});
    expect(getMorphAutomationProgress(settings, 25)).toEqual({position: 0.5, running: true});
  });

  it('validates the duration including both allowed endpoints', () => {
    for (const durationSeconds of [0.5, 600]) {
      expect(() => validateMorphAutomation({durationSeconds, loop: false})).not.toThrow();
    }
    for (const durationSeconds of [0, 0.49, 601, Infinity, NaN]) {
      expect(() => validateMorphAutomation({durationSeconds, loop: false})).toThrow();
    }
  });
});
