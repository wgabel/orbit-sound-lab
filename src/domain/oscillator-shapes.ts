export function foldSineSample(sample: number): number {
  const magnitude = Math.abs(sample);
  // Reflect the signal at alternating +1 and -1 thresholds. Input drive is bounded to ±4.
  const folded = magnitude <= 1 ? magnitude : magnitude <= 3 ? 2 - magnitude : magnitude - 4;
  return Math.sign(sample) * folded;
}
