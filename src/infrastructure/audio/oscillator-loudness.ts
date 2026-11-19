import type { OscillatorWaveform } from '../../domain/drone';
import { foldSineSample } from '../../domain/oscillator-shapes';
import { analyseCycleHarmonics, readCycleEnvelopeHarmonics } from './cycle-envelope-wave';
import { CLEAN_FOLD_INPUT_GAIN } from './sine-wavefolding';

export type CycleHarmonics = ReturnType<typeof readCycleEnvelopeHarmonics>;

// Fourier coefficients of sin(phase)^9, shared with the oscillator generator.
export const PEAKED_SINE_HARMONICS = Float32Array.from([0,126,0,-84,0,36,0,-9,0,1], coefficient => coefficient / 256);

const LAST_HARMONIC = 128;
const MAXIMUM_BOOST = 10 ** (3 / 20);
const MINIMUM_GAIN = 10 ** (-18 / 20);
const FOLD_ANALYSIS_SAMPLES = 256;

/** Use the A-weighting amplitude response only in the level estimate.
 * Its 1 kHz normalization factor cancels when comparing against the reference sine.
 */
function hearingWeight(frequency: number): number {
  const frequencySquared = frequency ** 2;
  return 12194 ** 2 * frequencySquared ** 2 / (
    (frequencySquared + 20.6 ** 2) *
    Math.sqrt((frequencySquared + 107.7 ** 2) * (frequencySquared + 737.9 ** 2)) *
    (frequencySquared + 12194 ** 2)
  );
}

export function analyseFoldedSineHarmonics(shape: number): CycleHarmonics {
  const drive = 1 + (1 / CLEAN_FOLD_INPUT_GAIN - 1) * shape;
  return analyseCycleHarmonics(Float64Array.from({length:FOLD_ANALYSIS_SAMPLES}, (_, index) =>
    foldSineSample(Math.sin(2 * Math.PI * index / FOLD_ANALYSIS_SAMPLES) * drive)));
}

function harmonicAmplitudeSquared(
  waveform: OscillatorWaveform, harmonic: number, shape: number, cycle?: CycleHarmonics
): number {
  const odd = harmonic % 2 === 1;
  const sine = Number(harmonic === 1);
  const triangle = odd ? (harmonic % 4 === 1 ? 1 : -1) * 8 / (Math.PI * harmonic) ** 2 : 0;
  switch (waveform) {
    case 'sine': return sine;
    case 'triangle': return triangle ** 2;
    case 'sineTriangle': return ((1 - shape) * sine + shape * triangle) ** 2;
    case 'square': return odd ? (4 / (Math.PI * harmonic)) ** 2 : 0;
    case 'sawtooth': return (2 / (Math.PI * harmonic)) ** 2;
    case 'variablePulse':
      return (2 * Math.sin(Math.PI * harmonic * shape) / (Math.PI * harmonic * Math.max(shape, 1 - shape))) ** 2;
    case 'peakedSine':
      return ((1 - shape) * sine + shape * (PEAKED_SINE_HARMONICS[harmonic] ?? 0)) ** 2;
    case 'foldedSine': return (cycle?.sine[harmonic] ?? 0) ** 2 + (cycle?.cosine[harmonic] ?? 0) ** 2;
    case 'cycleEnvelope':
      return ((1 - shape) * sine + shape * (cycle?.sine[harmonic] ?? 0)) ** 2 +
        (shape * (cycle?.cosine[harmonic] ?? 0)) ** 2;
  }
}

/** Match a sine at the same pitch, with bounded correction to protect headroom. */
export function readOscillatorLoudnessGain(
  waveform: OscillatorWaveform, frequency: number, shape: number, sampleRate: number, cycle?: CycleHarmonics
): number {
  if (waveform === 'sine' || frequency <= 0 || frequency >= sampleRate / 2) return 1;
  let weightedPower = 0;
  for (let harmonic = 1; harmonic <= LAST_HARMONIC && harmonic * frequency < sampleRate / 2; harmonic++) {
    const amplitudeSquared = harmonicAmplitudeSquared(waveform, harmonic, shape, cycle);
    weightedPower += amplitudeSquared * hearingWeight(harmonic * frequency) ** 2;
  }
  if (weightedPower === 0) return 1;
  const gain = hearingWeight(frequency) / Math.sqrt(weightedPower);
  return Math.max(MINIMUM_GAIN, Math.min(MAXIMUM_BOOST, gain));
}
