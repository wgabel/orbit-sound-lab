import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
export interface AudioSourceModule { readonly output: AudioNode; start(): void; stop(): void; dispose(): void; }
export interface AudioProcessorModule { readonly input: AudioNode; readonly output: AudioNode; dispose(): void; }
export interface ModulationTarget { readonly parameter: AudioParam; readonly minimum: number; readonly maximum: number; }
export interface DroneVoice extends AudioSourceModule { setGain(value: number): void; updateOscillator(settings: OscillatorSettings): void; gateOn(oscillatorId: string): void; gateOff(oscillatorId: string): void; getDetuneParameter(oscillatorId: string): AudioParam; getFilterCutoffParameters(oscillatorId: string): readonly AudioParam[]; }
export interface DroneVoiceFactory { create(settings: DroneSettings): DroneVoice; }
export interface SynthesizerController {
  readonly lowFrequencyOscillatorSettings: readonly LowFrequencyOscillatorSettings[];
  updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings): void;
  readonly settings: DroneSettings;
  readonly isPlaying: boolean;
  start(): Promise<void>;
  stop(): void;
  setGain(value: number): void;
  gateOn(oscillatorId: string): void;
  gateOff(oscillatorId: string): void;
  updateOscillator(settings: OscillatorSettings): void;
  dispose(): void;
}
