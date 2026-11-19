export interface SimplexNoiseSettings {
  readonly rate: number;
  readonly seed: number;
}

export const MINIMUM_SIMPLEX_NOISE_RATE = 0.01;
export const MAXIMUM_SIMPLEX_NOISE_RATE = 12;
export const MAXIMUM_SIMPLEX_NOISE_SEED = 65535;
export const DEFAULT_SIMPLEX_NOISE: SimplexNoiseSettings = {rate:0.6,seed:1};

export function validateSimplexNoise(settings: SimplexNoiseSettings): void {
  if (!Number.isFinite(settings.rate) || settings.rate < MINIMUM_SIMPLEX_NOISE_RATE || settings.rate > MAXIMUM_SIMPLEX_NOISE_RATE) {
    throw new Error('Simplex Noise rate must be between 0.01 and 12 cells/s.');
  }
  if (!Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > MAXIMUM_SIMPLEX_NOISE_SEED) {
    throw new Error('Simplex Noise seed must be a whole number between 0 and 65535.');
  }
}

function simplexCorner(lattice: number, distance: number, seed: number): number {
  let hash = lattice ^ Math.imul(seed,0x9e3779b9);
  hash = Math.imul(hash ^ (hash >>> 16),0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15),0x735a2d97);
  hash ^= hash >>> 15;
  const gradient = (1 + (hash & 7)) * (hash & 8 ? -1 : 1);
  const kernel = 1 - distance * distance;
  return distance * gradient * kernel ** 4;
}

/** One-dimensional simplex noise with a seeded gradient at each end of the cell. */
export function readSimplexNoise(settings: SimplexNoiseSettings, elapsed: number): number {
  const position = Math.max(0,elapsed) * settings.rate;
  const lattice = Math.floor(position);
  const distance = position - lattice;
  const signal = simplexCorner(lattice,distance,settings.seed) + simplexCorner(lattice + 1,distance - 1,settings.seed);
  // Maximum summed magnitude occurs at the cell midpoint with both gradients at full strength.
  return Math.max(0,Math.min(1,0.5 + signal / (16 * 0.75 ** 4)));
}
