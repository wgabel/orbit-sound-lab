import type { OscillatorSettings, OscillatorWaveform } from './drone';
import type { LowFrequencyOscillatorSettings, LowFrequencyOscillatorDestination, LowFrequencyOscillatorWaveform } from './modulation';

function randomStep(minimum: number, maximum: number, step: number): number {
  const numberOfSteps = Math.round((maximum - minimum) / step);
  return Number((minimum + Math.floor(Math.random() * (numberOfSteps + 1)) * step).toFixed(4));
}
function randomChoice<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}
export function randomizeOscillatorSettings(
  oscillator: OscillatorSettings,
  modulation: LowFrequencyOscillatorSettings
): { oscillator: OscillatorSettings; modulation: LowFrequencyOscillatorSettings } {
  const waveforms: readonly OscillatorWaveform[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const modulationWaveforms: readonly LowFrequencyOscillatorWaveform[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const destinations: readonly LowFrequencyOscillatorDestination[] = ['pitch', 'filterCutoff', 'amplitude'];
  return {
    oscillator: {
      ...oscillator,
      enabled: Math.random() < 0.5,
      frequencyHz: randomStep(40, 880, 1),
      detuneCents: randomStep(-100, 100, 1),
      waveform: randomChoice(waveforms),
      filter: {
        enabled: Math.random() < 0.5,
        cutoffHz: randomStep(20, 20000, 1),
        resonance: randomStep(0.1, 12, 0.1)
      },
      fade: {
        fadeInSeconds: randomStep(0.1, 30, 0.1),
        fadeOutSeconds: randomStep(0.1, 30, 0.1)
      }
    },
    modulation: {
      ...modulation,
      enabled: Math.random() < 0.5,
      destination: randomChoice(destinations),
      frequencyHz: randomStep(0.01, 20, 0.01),
      depthCents: randomStep(0, 300, 1),
      depthHz: randomStep(0, 5000, 10),
      depthAmplitude: randomStep(0, 0.5, 0.01),
      waveform: randomChoice(modulationWaveforms)
    }
  };
}
