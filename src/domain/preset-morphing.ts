import type { SoundPreset } from './preset-library';
import { normalizePresetModulations } from './preset-library';
import type { DroneSettings } from './drone';
import type { LowFrequencyOscillatorSettings } from './modulation';
import type { DelaySettings } from './delay';

export interface MorphedSound {
  readonly drone: DroneSettings;
  readonly modulation: readonly LowFrequencyOscillatorSettings[];
  readonly delay: DelaySettings;
}
const interpolate = (start: number, end: number, position: number): number => start + (end - start) * position;
const choose = <T>(start: T, end: T, position: number): T => position < 0.5 ? start : end;
const interpolateFrequency = (start: number, end: number, position: number): number =>
  Math.exp(interpolate(Math.log(start), Math.log(end), position));

/** Pure interpolation: continuous controls glide; discrete controls switch at the midpoint. */
export function morphPresets(start: SoundPreset, end: SoundPreset, position: number): MorphedSound {
  if (!Number.isFinite(position) || position < 0 || position > 1) throw new Error('Morph position must be between 0 and 1.');
  const startModulations = normalizePresetModulations(start.modulation, start.drone.oscillators.map(item => item.id));
  const endNormalizedModulations = normalizePresetModulations(end.modulation, end.drone.oscillators.map(item => item.id));
  if (position === 0) return {drone: start.drone, modulation: startModulations, delay: start.delay};
  if (position === 1) return {drone: end.drone, modulation: endNormalizedModulations, delay: end.delay};
  const endOscillators = new Map(end.drone.oscillators.map(oscillator => [oscillator.id, oscillator]));
  const endModulations = new Map(endNormalizedModulations.map(modulation => [modulation.targetOscillatorId + ':' + modulation.destination, modulation]));
  if (start.drone.oscillators.length !== endOscillators.size || startModulations.length !== endModulations.size) throw new Error('Presets have incompatible oscillator layouts.');
  const drone: DroneSettings = {
    ...start.drone,
    gain: interpolate(start.drone.gain, end.drone.gain, position),
    oscillators: start.drone.oscillators.map(a => {
      const b = endOscillators.get(a.id);
      if (!b) throw new Error('Presets have incompatible oscillator identifiers.');
      return {
        ...a,
        enabled: choose(a.enabled, b.enabled, position),
        waveform: choose(a.waveform, b.waveform, position),
        frequencyHz: interpolateFrequency(a.frequencyHz, b.frequencyHz, position),
        detuneCents: interpolate(a.detuneCents, b.detuneCents, position),
        volume: interpolate(a.volume, b.volume, position),
        fade: {
          fadeInSeconds: interpolate(a.fade.fadeInSeconds, b.fade.fadeInSeconds, position),
          fadeOutSeconds: interpolate(a.fade.fadeOutSeconds, b.fade.fadeOutSeconds, position)
        },
        filter: {
          enabled: choose(a.filter.enabled, b.filter.enabled, position),
          cutoffHz: interpolateFrequency(a.filter.cutoffHz, b.filter.cutoffHz, position),
          resonance: interpolate(a.filter.resonance, b.filter.resonance, position)
        }
      };
    })
  };
  const modulation: readonly LowFrequencyOscillatorSettings[] = startModulations.map(a => {
    const b = endModulations.get(a.targetOscillatorId + ':' + a.destination);
    if (!b) throw new Error('Presets have incompatible modulation targets.');
    return {
      ...a,
      enabled: choose(a.enabled, b.enabled, position),
      destination: choose(a.destination, b.destination, position),
      waveform: choose(a.waveform, b.waveform, position),
      frequencyHz: interpolateFrequency(a.frequencyHz, b.frequencyHz, position),
      depthCents: interpolate(a.depthCents, b.depthCents, position),
      depthHz: interpolate(a.depthHz, b.depthHz, position),
      depthAmplitude: interpolate(a.depthAmplitude, b.depthAmplitude, position)
    };
  });
  const delay: DelaySettings = {
    enabled: choose(start.delay.enabled, end.delay.enabled, position),
    timeSeconds: interpolate(start.delay.timeSeconds, end.delay.timeSeconds, position),
    feedback: interpolate(start.delay.feedback, end.delay.feedback, position),
    mix: interpolate(start.delay.mix, end.delay.mix, position)
  };
  return {drone, modulation, delay};
}
