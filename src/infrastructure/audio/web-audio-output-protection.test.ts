import { describe, expect, it } from 'vitest';
import { limitOutputPeak } from './web-audio-output-protection';

describe('output peak limiter', () => {
  it('passes lower levels through with unity gain', () => {
    for (const sample of [-0.85, -0.1, 0, 0.1, 0.85]) {
      expect(limitOutputPeak(sample)).toBe(sample);
    }
  });

  it('smoothly attenuates positive and negative peaks before clipping', () => {
    const beforeKnee = limitOutputPeak(0.8499);
    const afterKnee = limitOutputPeak(0.8501);
    expect((afterKnee - beforeKnee) / 0.0002).toBeCloseTo(1, 3);
    expect(limitOutputPeak(1.31)).toBeLessThan(0.97);
    expect(limitOutputPeak(-1.31)).toBe(-limitOutputPeak(1.31));
    expect(limitOutputPeak(4)).toBeCloseTo(0.97, 5);
  });
});
