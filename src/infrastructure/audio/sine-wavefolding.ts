export const CLEAN_FOLD_INPUT_GAIN = 0.25;
const FOLD_THRESHOLD = 1;
const MAXIMUM_DRIVE = 1 / CLEAN_FOLD_INPUT_GAIN;
const CURVE_SAMPLES = 2049;

export const SINE_FOLD_CURVE = Float32Array.from({length: CURVE_SAMPLES}, (_, index) => {
  const input = (2 * index / (CURVE_SAMPLES - 1) - 1) * MAXIMUM_DRIVE;
  const magnitude = Math.abs(input);
  // Reflect the signal at alternating +1 and -1 thresholds.
  const folded = magnitude <= FOLD_THRESHOLD ? magnitude : magnitude <= 3 ? 2 - magnitude : magnitude - 4;
  return Math.sign(input) * folded;
});
