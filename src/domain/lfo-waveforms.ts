import { DEFAULT_OSCILLATOR_SHAPE } from './oscillator-waveforms';
import type { LowFrequencyOscillatorWaveform } from './modulation';
import { foldSineSample } from './oscillator-shapes';

export const LFO_PULSE_WIDTH = 0.25;

export function readPeriodicLfoSample(waveform: Exclude<LowFrequencyOscillatorWaveform,'smoothRandom'>, phase: number): number {
  switch (waveform) {
    case 'sine': return Math.sin(2 * Math.PI * phase);
    case 'triangle': return 1 - 4 * Math.abs(phase - 0.5);
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * phase - 1;
    case 'variablePulse': return phase < LFO_PULSE_WIDTH ? 1 : -1;
    case 'sineTriangle': {
      const sine = Math.sin(2 * Math.PI * phase);
      const triangle = 1 - 4 * Math.abs((phase + 0.25) % 1 - 0.5);
      return sine + (triangle - sine) * DEFAULT_OSCILLATOR_SHAPE;
    }
    case 'foldedSine': return foldSineSample(Math.sin(2 * Math.PI * phase) * (1 + 3 * DEFAULT_OSCILLATOR_SHAPE));
    case 'peakedSine': {
      const sine = Math.sin(2 * Math.PI * phase);
      return sine + (sine ** 9 - sine) * DEFAULT_OSCILLATOR_SHAPE;
    }
  }
}
