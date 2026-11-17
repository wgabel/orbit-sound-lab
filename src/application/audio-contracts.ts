import type { DroneSettings, OscillatorSettings } from '../domain/drone';
/** Audio graph modules expose their output, allowing serial routing through future effects. */
export interface AudioSourceModule { readonly output: AudioNode; start(): void; stop(): void; dispose(): void; }
/** Processors accept audio and expose processed audio. */
export interface AudioProcessorModule { readonly input: AudioNode; readonly output: AudioNode; dispose(): void; }
/** Control targets are independent from audio routing; future LFOs can target AudioParams. */
export interface ModulationTarget { readonly parameter: AudioParam; readonly minimum: number; readonly maximum: number; }
export interface DroneVoice extends AudioSourceModule { setGain(value: number): void; updateOscillator(settings: OscillatorSettings): void; }
export interface DroneVoiceFactory { create(settings: DroneSettings): DroneVoice; }
export interface SynthesizerController { readonly settings: DroneSettings; readonly isPlaying: boolean; start(): Promise<void>; stop(): void; setGain(value: number): void; updateOscillator(settings: OscillatorSettings): void; dispose(): void; }
