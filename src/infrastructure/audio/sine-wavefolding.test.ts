import { expect, it } from 'vitest';
import { CLEAN_FOLD_INPUT_GAIN, SINE_FOLD_CURVE } from './sine-wavefolding';

function sample(input: number): number {
  return SINE_FOLD_CURVE[Math.round((input + 1) / 2 * (SINE_FOLD_CURVE.length - 1))];
}

it('passes a clean sine at minimum drive and reflects the signal at both thresholds', () => {
  expect(sample(0)).toBe(0);
  expect(sample(CLEAN_FOLD_INPUT_GAIN / 2)).toBe(0.5);
  expect(sample(CLEAN_FOLD_INPUT_GAIN)).toBe(1);
  expect(sample(0.5)).toBe(0);
  expect(sample(0.75)).toBe(-1);
  expect(sample(1)).toBe(0);
  expect(SINE_FOLD_CURVE.every((value, index) =>
    Math.abs(value) <= 1 && value === -SINE_FOLD_CURVE[SINE_FOLD_CURVE.length - 1 - index])).toBe(true);
});
