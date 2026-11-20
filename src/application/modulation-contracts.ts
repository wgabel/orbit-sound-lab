import type { LowFrequencyOscillatorSettings } from '@domain/modulation';
/** Modulation is control signal routing, independent of the audio graph. */
export interface ModulationSource { readonly output: AudioNode; start(): void; dispose(): void; update(settings: LowFrequencyOscillatorSettings): void; }
export interface ModulationDestination { readonly id: string; readonly parameter: AudioParam; }
export interface ModulationSourceFactory { create(settings: LowFrequencyOscillatorSettings): ModulationSource; }
export interface ModulationMatrix {
  connect(source: ModulationSource, destination: ModulationDestination): void;
  disconnect(source: ModulationSource, destination: ModulationDestination): void;
  dispose(): void;
}
