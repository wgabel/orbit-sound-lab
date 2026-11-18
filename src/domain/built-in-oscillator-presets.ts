import presetData from './built-in-oscillator-presets.json';
import { validateOscillatorSettings } from './drone';
import type { OscillatorSettings, OscillatorWaveform } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import type { OscillatorSnapshot } from './oscillator-clipboard';

export const builtInOscillatorPresets: readonly {id: string; name: string}[] = presetData;

export function createBuiltInOscillatorSnapshot(presetId: string, target: OscillatorSettings): OscillatorSnapshot {
  const preset = presetData.find(item => item.id === presetId);
  if (!preset) throw new Error('Unknown oscillator preset.');

  const {waveform, frequencyHz, volume, pan, detuneCents, filter} = preset.settings;
  const oscillator: OscillatorSettings = {
    ...target, waveform: waveform as OscillatorWaveform, frequencyHz, volume, pan, detuneCents, filter
  };
  validateOscillatorSettings(oscillator);
  return {oscillator, modulations: createDefaultLowFrequencyOscillators([target.id])};
}
