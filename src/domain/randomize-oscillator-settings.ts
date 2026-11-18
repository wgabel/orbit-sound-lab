import type { OscillatorSettings, OscillatorWaveform } from './drone';
import type { LowFrequencyOscillatorSettings, LowFrequencyOscillatorWaveform } from './modulation';

export type OscillatorRandomizationMode = 'random' | 'variant';
const VARIANT_FRACTION = 0.05;

function randomStep(_current: number, minimum: number, maximum: number, step: number): number {
  const numberOfSteps = Math.round((maximum - minimum) / step);
  return Number((minimum + Math.floor(Math.random() * (numberOfSteps + 1)) * step).toFixed(4));
}

function varyValue(current: number, minimum: number, maximum: number): number {
  const radius = Math.abs(current) * VARIANT_FRACTION;
  // Older presets can contain valid values outside the slider range. Only vary them toward that range.
  const lower = Math.max(Math.min(minimum, current), current - radius);
  const upper = Math.min(Math.max(maximum, current), current + radius);
  const rounded = Number((lower + (upper - lower) * Math.random()).toFixed(4));
  return Math.min(upper, Math.max(lower, rounded));
}

function randomChoice<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function randomizeOscillatorSettings(
  oscillator: OscillatorSettings,
  modulations: readonly LowFrequencyOscillatorSettings[],
  mode: OscillatorRandomizationMode
): {oscillator: OscillatorSettings; modulations: readonly LowFrequencyOscillatorSettings[]} {
  const isVariant = mode === 'variant';
  const randomizeValue = isVariant ? varyValue : randomStep;
  const waveforms: readonly OscillatorWaveform[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const modulationWaveforms: readonly LowFrequencyOscillatorWaveform[] = ['sine', 'triangle', 'square', 'sawtooth'];
  return {
    oscillator: {
      ...oscillator,
      frequencyHz: randomizeValue(oscillator.frequencyHz, 40, 880, 1),
      volume: randomizeValue(oscillator.volume, 0, 1, 0.01),
      detuneCents: randomizeValue(oscillator.detuneCents, -100, 100, 1),
      waveform: isVariant ? oscillator.waveform : randomChoice(waveforms),
      filter: {
        enabled: isVariant ? oscillator.filter.enabled : Math.random() < 0.5,
        cutoffHz: randomizeValue(oscillator.filter.cutoffHz, 20, 20000, 1),
        resonance: randomizeValue(oscillator.filter.resonance, 0.1, 12, 0.1)
      }
    },
    modulations: modulations.map(modulation => ({
      ...modulation,
      enabled: isVariant ? modulation.enabled : Math.random() < 0.5,
      frequencyHz: randomizeValue(modulation.frequencyHz, 0.01, 20, 0.01),
      depthCents: randomizeValue(modulation.depthCents, 0, 300, 1),
      depthHz: randomizeValue(modulation.depthHz, 0, 5000, 10),
      depthAmplitude: randomizeValue(modulation.depthAmplitude, 0, 0.5, 0.01),
      waveform: isVariant ? modulation.waveform : randomChoice(modulationWaveforms)
    }))
  };
}
