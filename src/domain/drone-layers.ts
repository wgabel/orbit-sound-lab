import { createDefaultDroneSettings } from './drone';
import type { DroneSettings } from './drone';
import { DEFAULT_HARMONY_SETTINGS } from './harmony';
import type { HarmonySettings } from './harmony';
import { createDefaultLowFrequencyOscillators } from './modulation';
import type { LowFrequencyOscillatorSettings } from './modulation';

export const DRONE_LAYER_IDS = ['A', 'B'] as const;
export type DroneLayerId = typeof DRONE_LAYER_IDS[number];

export interface DroneLayer {
  readonly drone: DroneSettings;
  readonly modulation: readonly LowFrequencyOscillatorSettings[];
  readonly harmony: HarmonySettings;
  readonly enabled: boolean;
}

export interface LayerMix {
  readonly firstLayerEnabled: boolean;
  readonly secondLayer: DroneLayer;
  readonly masterGain: number;
}

export function createDefaultDroneLayer(id: DroneLayerId): DroneLayer {
  const initial = createDefaultDroneSettings();
  const drone = id === 'A' ? initial : {...initial,
    oscillators: initial.oscillators.map(oscillator => ({...oscillator, frequencyHz: oscillator.frequencyHz * 2}))
  };
  return {
    drone,
    modulation: createDefaultLowFrequencyOscillators(drone.oscillators.map(oscillator => oscillator.id)),
    harmony: DEFAULT_HARMONY_SETTINGS,
    enabled: id === 'A'
  };
}

export function createDefaultLayerMix(): LayerMix {
  return {firstLayerEnabled: true, secondLayer: createDefaultDroneLayer('B'), masterGain: 1};
}

export function validateMasterGain(gain: number): void {
  if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new Error('Master level must be between 0 and 1.');
}
