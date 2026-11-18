import type { OscillatorSettings } from './drone';
import type { LowFrequencyOscillatorSettings } from './modulation';

export interface OscillatorSnapshot {
  readonly oscillator: OscillatorSettings;
  readonly modulations: readonly LowFrequencyOscillatorSettings[];
}

export function retargetOscillatorSnapshot(snapshot: OscillatorSnapshot, target: OscillatorSettings): OscillatorSnapshot {
  return {
    oscillator: {...snapshot.oscillator, id: target.id, enabled: target.enabled},
    modulations: snapshot.modulations.map(setting => ({...setting, targetOscillatorId: target.id}))
  };
}
