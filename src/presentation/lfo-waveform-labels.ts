import { LFO_PULSE_WIDTH } from '@domain/lfo-waveforms';
import type { LowFrequencyOscillatorWaveform } from '@domain/modulation';

export const LFO_WAVEFORM_LABELS: Readonly<Record<LowFrequencyOscillatorWaveform,string>> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Sawtooth',
  smoothRandom: 'Smooth Random',
  sineTriangle: 'Sine ↔ Triangle',
  variablePulse: `Variable Pulse (${LFO_PULSE_WIDTH * 100}%)`,
  foldedSine: 'Folded Sine',
  peakedSine: 'Peaked Sine'
};
