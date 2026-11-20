import type { ChordSettings } from '@domain/chord';
import type { ChordProgression } from '@domain/chord-progression';
import type { CycleEnvelope } from '@domain/cycle-envelope';
import type { DroneSettings, OscillatorWaveform, ShelfEqSettings } from '@domain/drone';
import type { DroneLayer, DroneLayerId } from '@domain/drone-layers';
import { DEFAULT_HARMONY_SETTINGS } from '@domain/harmony';
import type { HarmonySettings } from '@domain/harmony';
import { createDefaultLowFrequencyOscillators } from '@domain/modulation';
import type { LowFrequencyOscillatorSettings } from '@domain/modulation';
import type { ReverbSettings } from '@domain/reverb';
import type { SimplexNoiseSettings } from '@domain/simplex-noise';
import type { PatchAutomation } from './automation';
import type { PatchLfo } from './lfo';

export interface PatchModuleSettings {
  chord: ChordSettings;
  chordProgression: ChordProgression;
  wave: {
    readonly waveform: OscillatorWaveform;
    readonly frequency: number;
    readonly shape: number;
    readonly cycleEnvelope?: CycleEnvelope;
  };
  drone: {
    readonly voice: DroneSettings;
    readonly modulation?: readonly LowFrequencyOscillatorSettings[];
    readonly harmony?: HarmonySettings;
    readonly copiedFrom?: DroneLayerId;
  };
  automation: PatchAutomation;
  lfo: PatchLfo;
  simplexNoise: SimplexNoiseSettings;
  filter: {readonly cutoff: number; readonly resonance: number};
  gain: {readonly level: number};
  pitchShift: {readonly semitones: number; readonly cents: number};
  shelfEq: ShelfEqSettings;
  reverb: ReverbSettings;
  mixer: {readonly levelA: number; readonly levelB: number};
  crossfader: {readonly blend: number};
  oscilloscope: Record<string, never>;
  output: {readonly level: number};
}

export type PatchModuleKind = keyof PatchModuleSettings;
export type PatchModule = {
  [Kind in PatchModuleKind]: {
    readonly id: string;
    readonly kind: Kind;
    readonly settings: PatchModuleSettings[Kind];
  }
}[PatchModuleKind];
export type PatchModuleOf<Kind extends PatchModuleKind> = Extract<PatchModule,{kind:Kind}>;
export type PatchDrone = PatchModuleOf<'drone'>;

export function readPatchDroneLayer(module: PatchDrone): DroneLayer {
  const {voice,modulation,harmony} = module.settings;
  return {
    drone:voice,
    modulation:modulation ?? createDefaultLowFrequencyOscillators(
      voice.oscillators.map(oscillator => oscillator.id)),
    harmony:harmony ?? DEFAULT_HARMONY_SETTINGS,
    enabled:true
  };
}

export function setPatchDroneLayer(module: PatchDrone, layer: DroneLayer, copiedFrom?: DroneLayerId): PatchDrone {
  return {...module,settings:structuredClone({
    voice:layer.drone,
    modulation:layer.modulation,
    harmony:layer.harmony,
    copiedFrom
  })};
}

export interface NodePosition {readonly x: number; readonly y: number}
export type PatchLayout = Readonly<Record<string,NodePosition>>;
export const MAXIMUM_NODE_POSITION = 2400;
export const MINIMUM_NODE_POSITION = -MAXIMUM_NODE_POSITION;
export const PATCH_CANVAS_MINIMUM = MINIMUM_NODE_POSITION - 36;

export interface PatchEndpoint {
  readonly moduleId: string;
  readonly portId: string;
}

export interface CableMapping {
  readonly from: number;
  readonly to: number;
}

export interface PatchCable {
  readonly id: string;
  readonly source: PatchEndpoint;
  readonly destination: PatchEndpoint;
  readonly mapping?: CableMapping;
  readonly inverted?: boolean;
  readonly enabled?: boolean;
}

export interface Patch {
  readonly version: 1;
  readonly modules: readonly PatchModule[];
  readonly cables: readonly PatchCable[];
}

export interface PatchParameter {
  readonly unit: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly displayScale?: number;
  readonly defaultMaximum?: number;
}

export interface PatchPort {
  readonly id: string;
  readonly label: string;
  readonly direction: 'input' | 'output';
  readonly signal: 'audio' | 'control' | 'chords';
  readonly parameter?: PatchParameter;
}
