import { LFO_MAXIMUM_RATE_HZ, LFO_MINIMUM_RATE_HZ, LOW_FREQUENCY_OSCILLATOR_WAVEFORMS } from './modulation';
import type { LowFrequencyOscillatorWaveform } from './modulation';

export interface PatchLfo {
  readonly waveform: LowFrequencyOscillatorWaveform;
  readonly rateHz: number;
  readonly sync: boolean;
  readonly phaseDegrees: number;
}

export const DEFAULT_PATCH_LFO: PatchLfo = {waveform:'sine',rateHz:0.2,sync:true,phaseDegrees:0};

export function validatePatchLfo(settings: PatchLfo): void {
  if (!LOW_FREQUENCY_OSCILLATOR_WAVEFORMS.includes(settings.waveform) || typeof settings.sync !== 'boolean' ||
      !Number.isFinite(settings.rateHz) || settings.rateHz < LFO_MINIMUM_RATE_HZ ||
      settings.rateHz > LFO_MAXIMUM_RATE_HZ || !Number.isFinite(settings.phaseDegrees) ||
      settings.phaseDegrees < 0 || settings.phaseDegrees > 360) throw new Error('Invalid LFO settings.');
}

export function readPatchLfoPhase(settings: PatchLfo, elapsed: number): number {
  const offset = settings.sync ? settings.phaseDegrees / 360 : 0;
  return (Math.max(elapsed,0) * settings.rateHz + offset) % 1;
}

export function readLfoPreviewValue(waveform: Exclude<LowFrequencyOscillatorWaveform,'smoothRandom'>, phase: number): number {
  switch (waveform) {
    case 'sine': return (1 + Math.sin(2 * Math.PI * phase)) / 2;
    case 'triangle': return 1 - 2 * Math.abs(phase - 0.5);
    case 'square': return phase < 0.5 ? 1 : 0;
    case 'sawtooth': return phase;
  }
}
