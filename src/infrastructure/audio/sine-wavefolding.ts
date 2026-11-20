import { foldSineSample } from '@domain/oscillator-shapes';

export const CLEAN_FOLD_INPUT_GAIN = 0.25;
const MAXIMUM_DRIVE = 1 / CLEAN_FOLD_INPUT_GAIN;
const CURVE_SAMPLES = 2049;

export const SINE_FOLD_CURVE = Float32Array.from({length: CURVE_SAMPLES}, (_, index) => {
  const input = (2 * index / (CURVE_SAMPLES - 1) - 1) * MAXIMUM_DRIVE;
  return foldSineSample(input);
});
