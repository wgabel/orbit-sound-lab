import type { SynthesizerController } from './audio-contracts';
import type { DroneSettings } from '@domain/drone';
import type { LowFrequencyOscillatorSettings } from '@domain/modulation';
/** Applies settings edited before the audio context is first created. */
export function applyInitialSynthesizerSettings(controller: SynthesizerController, drone: DroneSettings, modulations: readonly LowFrequencyOscillatorSettings[]): void {
  for (const oscillator of drone.oscillators) controller.updateOscillator(oscillator);
  controller.setMix(drone.mix);
  for (const modulation of modulations) controller.updateLowFrequencyOscillator(modulation);
}
