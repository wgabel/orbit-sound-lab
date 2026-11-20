import { describe, expect, it } from 'vitest';
import { applyPitchOffset } from '@domain/modulation';
import { getSliderPosition, getSliderValue } from './slider-scale';

describe('slider scales', () => {
  it('uses equal track distance for equal frequency ratios', () => {
    const position = (frequency: number) => getSliderPosition(frequency, 20, 20000, 'logarithmic');
    expect(getSliderValue(0.5, 20, 20000, 'logarithmic')).toBeCloseTo(632.46, 2);
    expect(position(100) - position(50)).toBeCloseTo(position(1000) - position(500));
    expect(getSliderValue(position(43.2), 20, 20000, 'logarithmic')).toBeCloseTo(43.2);
  });

  it('gives a fixed pitch depth equal track width in different registers', () => {
    const position = (frequency: number) => getSliderPosition(frequency, 40, 880, 'logarithmic');
    const bandWidth = (base: number) => position(applyPitchOffset(base, 25)) - position(applyPitchOffset(base, -25));
    expect(bandWidth(55)).toBeCloseTo(bandWidth(660), 12);
  });

  it('expands low values while keeping zero and full scale accessible', () => {
    for (const maximum of [1, 0.5]) {
      expect(getSliderValue(0, 0, maximum, 'quadratic')).toBe(0);
      expect(getSliderValue(1, 0, maximum, 'quadratic')).toBe(maximum);
      expect(getSliderValue(0.1, 0, maximum, 'quadratic')).toBeCloseTo(maximum * 0.01);
      expect(getSliderPosition(maximum * 0.0625, 0, maximum, 'quadratic')).toBe(0.25);
    }
  });

  it('clamps positions and values at either end of the track', () => {
    expect(getSliderPosition(0, 20, 20000, 'logarithmic')).toBe(0);
    expect(getSliderPosition(21000, 20, 20000, 'logarithmic')).toBe(1);
    expect(getSliderValue(-0.1, 20, 20000, 'logarithmic')).toBe(20);
    expect(getSliderValue(1.1, 0, 1, 'quadratic')).toBe(1);
  });
});
