import type { DroneLayerId } from '../domain/drone-layers';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneMixSettings, DroneSettings, OscillatorSettings } from '../domain/drone';
export interface AudioSourceModule { readonly output: AudioNode; start(): void; stop(): Promise<void>; dispose(): void; }
export interface AudioProcessorModule { readonly input: AudioNode; readonly output: AudioNode; dispose(): void; }
export interface ModulationTarget { readonly parameter: AudioParam; readonly minimum: number; readonly maximum: number; }
export interface DroneVoice extends AudioSourceModule { setGain(value: number): void; setMix(mix: DroneMixSettings): void; updateOscillator(settings: OscillatorSettings): void; getAmplitudeParameter(oscillatorId: string): AudioParam; getDetuneParameter(oscillatorId: string): AudioParam; getFilterCutoffParameters(oscillatorId: string): readonly AudioParam[]; getWaveformAnalyser?(oscillatorId: string): AnalyserNode | null; }
export interface DroneVoiceFactory { create(settings: DroneSettings): DroneVoice; }
export interface SynthesizerController {
  readonly lowFrequencyOscillatorSettings: readonly LowFrequencyOscillatorSettings[];
  updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings): void;
  readonly settings: DroneSettings;
  getWaveformAnalyser(oscillatorId: string): AnalyserNode | null;
  readonly isPlaying: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  setGain(value: number): void;
  setMix(mix: DroneMixSettings): void;
  updateOscillator(settings: OscillatorSettings): void;
  dispose(): void;
}

/** Composition-level interface: effects belong to the instrument, not the drone voice controller. */
export interface SoundLabController {
  readonly layers: Readonly<Record<DroneLayerId, SynthesizerController>>;
  readonly isPlaying: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  setLayersEnabled(enabled: Readonly<Record<DroneLayerId, boolean>>): Promise<void>;
  setMasterGain(gain: number): void;
  dispose(): void;
  readonly delaySettings: import('../domain/delay').DelaySettings;
  updateDelay(settings: import('../domain/delay').DelaySettings): void;
}
