import { createDefaultDroneSettings, OSCILLATOR_WAVEFORMS, supportsOscillatorShape, validateDroneSettings } from './drone';
import type { DroneSettings, OscillatorWaveform } from './drone';
import type { DroneLayer, DroneLayerId } from './drone-layers';
import type { LowFrequencyOscillatorSettings } from './modulation';
import { tuneSceneLayer } from './sound-scene';
import { DEFAULT_PATCH_LFO, validatePatchLfo } from './patch-lfo';
import type { PatchLfo } from './patch-lfo';
import { validateAutomation } from './patch-automation';
import type { PatchAutomation } from './patch-automation';

export interface PatchModuleSettings {
  wave: {readonly waveform: OscillatorWaveform; readonly frequency: number; readonly shape: number};
  drone: {
    readonly voice: DroneSettings;
    readonly modulation?: readonly LowFrequencyOscillatorSettings[];
    readonly copiedFrom?: DroneLayerId;
  };
  automation: PatchAutomation;
  lfo: PatchLfo;
  filter: {readonly cutoff: number; readonly resonance: number};
  gain: {readonly level: number};
  mixer: {readonly levelA: number; readonly levelB: number};
  output: {readonly level: number};
}

export type PatchModuleKind = keyof PatchModuleSettings;
export type PatchModule = {
  [Kind in PatchModuleKind]: {readonly id: string; readonly kind: Kind; readonly settings: PatchModuleSettings[Kind]}
}[PatchModuleKind];

export type PatchDrone = Extract<PatchModule, {kind: 'drone'}>;

export function copyDroneLayerToPatch(module: PatchDrone, layerId: DroneLayerId, layer: DroneLayer): PatchDrone {
  return {...module, settings:structuredClone({
    voice:tuneSceneLayer(layer), modulation:layer.modulation, copiedFrom:layerId
  })};
}

export interface PatchEndpoint { readonly moduleId: string; readonly portId: string; }
export interface CableMapping { readonly from: number; readonly to: number; }
export interface PatchCable {
  readonly id: string;
  readonly source: PatchEndpoint;
  readonly destination: PatchEndpoint;
  readonly mapping?: CableMapping;
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
}
export interface PatchPort {
  readonly id: string;
  readonly label: string;
  readonly direction: 'input' | 'output';
  readonly signal: 'audio' | 'control';
  readonly parameter?: PatchParameter;
}

export const MODULE_LABELS: Readonly<Record<PatchModuleKind, string>> = {
  wave: 'Wave', drone: 'Drone', automation: 'Automation', filter: 'Low-pass filter', gain: 'Gain',
  lfo: 'LFO', mixer: 'Mixer', output: 'Output'
};

export function getPatchModuleLabel(module: PatchModule): string {
  return module.kind === 'drone' && module.settings.copiedFrom
    ? `Drone ${module.settings.copiedFrom}` : MODULE_LABELS[module.kind];
}

const audioInput: PatchPort = {id:'in', label:'Audio in', direction:'input', signal:'audio'};
const audioOutput: PatchPort = {id:'out', label:'Audio out', direction:'output', signal:'audio'};
const level: PatchPort = {id:'level', label:'Level', direction:'input', signal:'control',
  parameter:{unit:'%', minimum:0, maximum:1, displayScale:100}};
const shape: PatchPort = {id:'shape', label:'Shape', direction:'input', signal:'control',
  parameter:{unit:'%', minimum:0, maximum:1, displayScale:100}};

export function getPatchPorts(module: PatchModule): readonly PatchPort[] {
  switch (module.kind) {
    case 'wave': return [
      audioOutput,
      {id:'frequency', label:'Frequency', direction:'input', signal:'control', parameter:{unit:'Hz', minimum:40, maximum:880}},
      ...(supportsOscillatorShape(module.settings.waveform) ? [shape] : [])
    ];
    case 'drone': return [audioOutput];
    case 'lfo':
    case 'automation': return [{id:'control', label:'Value', direction:'output', signal:'control'}];
    case 'filter': return [
      audioInput, audioOutput,
      {id:'cutoff', label:'Cutoff', direction:'input', signal:'control', parameter:{unit:'Hz', minimum:40, maximum:6000}},
      {id:'resonance', label:'Resonance', direction:'input', signal:'control', parameter:{unit:'Q', minimum:0.1, maximum:12}}
    ];
    case 'gain': return [audioInput, audioOutput, level];
    case 'mixer': return [
      {...audioInput, id:'inputA', label:'Audio A'},
      {...audioInput, id:'inputB', label:'Audio B'},
      {...level, id:'levelA', label:'Level A'},
      {...level, id:'levelB', label:'Level B'},
      audioOutput
    ];
    case 'output': return [audioInput, level];
  }
}

export function getPatchPort(patch: Patch, endpoint: PatchEndpoint): PatchPort | undefined {
  const module = patch.modules.find(item => item.id === endpoint.moduleId);
  return module && getPatchPorts(module).find(item => item.id === endpoint.portId);
}

export function sameEndpoint(first: PatchEndpoint, second: PatchEndpoint): boolean {
  return first.moduleId === second.moduleId && first.portId === second.portId;
}

export function hasPatchCycle(cables: readonly PatchCable[]): boolean {
  const children = new Map<string, string[]>();
  for (const {source, destination} of cables) {
    const existing = children.get(source.moduleId);
    if (existing) existing.push(destination.moduleId);
    else children.set(source.moduleId, [destination.moduleId]);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function visit(id: string): boolean {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    for (const child of children.get(id) ?? []) if (visit(child)) return true;
    active.delete(id);
    visited.add(id);
    return false;
  }
  return [...children.keys()].some(visit);
}

function within(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validatePatch(patch: Patch): void {
  if (patch.version !== 1 || patch.modules.length > 64 || patch.cables.length > 192) throw new Error('Unsupported patch size or version.');
  if (new Set(patch.modules.map(module => module.id)).size !== patch.modules.length ||
      new Set(patch.cables.map(cable => cable.id)).size !== patch.cables.length) throw new Error('Patch IDs must be unique.');
  for (const module of patch.modules) {
    if (!module.id) throw new Error('A module needs an identifier.');
    if (module.kind === 'automation') {
      validateAutomation(module.settings);
      continue;
    }
    if (module.kind === 'lfo') {
      validatePatchLfo(module.settings);
      continue;
    }
    if (module.kind === 'drone') {
      validateDroneSettings(module.settings.voice);
      continue;
    }
    if (module.kind === 'wave' && !OSCILLATOR_WAVEFORMS.includes(module.settings.waveform)) throw new Error('Unknown waveform.');
    for (const port of getPatchPorts(module)) {
      if (!port.parameter) continue;
      const settings: Readonly<Record<string, unknown>> = module.settings;
      const value = settings[port.id];
      if (typeof value !== 'number' || !within(value, port.parameter.minimum, port.parameter.maximum)) {
        throw new Error(`${port.label} is outside its supported range.`);
      }
    }
  }
  const destinations = new Set<string>();
  for (const {source, destination, mapping} of patch.cables) {
    const output = getPatchPort(patch, source);
    const input = getPatchPort(patch, destination);
    if (!output || !input || output.direction !== 'output' || input.direction !== 'input' ||
        output.signal !== input.signal) throw new Error('Choose a compatible input.');
    const destinationKey = JSON.stringify([destination.moduleId, destination.portId]);
    if (destinations.has(destinationKey)) throw new Error('This input already has a cable.');
    destinations.add(destinationKey);
    if (input.parameter) {
      const {minimum, maximum} = input.parameter;
      if (!mapping || !within(mapping.from, minimum, maximum) || !within(mapping.to, minimum, maximum)) {
        throw new Error(`${input.label} mapping must be between ${minimum} and ${maximum} ${input.parameter.unit}.`);
      }
    } else if (mapping) throw new Error('Audio cables do not have a parameter mapping.');
  }
  if (hasPatchCycle(patch.cables)) throw new Error('This cable would create a feedback loop.');
}

export function connectPatchPorts(patch: Patch, id: string, source: PatchEndpoint, destination: PatchEndpoint): Patch {
  const parameter = getPatchPort(patch, destination)?.parameter;
  const mapping = parameter ? {from:parameter.minimum, to:parameter.maximum} : undefined;
  const next = {...patch, cables:[...patch.cables, {id, source, destination, mapping}]};
  validatePatch(next);
  return next;
}

export function createPatchModule(kind: PatchModuleKind, id: string): PatchModule {
  switch (kind) {
    case 'wave': return {id, kind, settings:{waveform:'sine', frequency:110, shape:0.5}};
    case 'drone': return {id, kind, settings:{voice:createDefaultDroneSettings()}};
    case 'automation': return {id, kind, settings:{shape:'steps', mode:'loop', duration:8, glide:0,
      points:[0, 0.75, 0.25, 1, 0.1, 0.58, 0.23, 0.87, 0.87].map((value, index) => ({position:index / 8, value}))}};
    case 'lfo': return {id, kind, settings:DEFAULT_PATCH_LFO};
    case 'filter': return {id, kind, settings:{cutoff:900, resonance:0.7}};
    case 'gain': return {id, kind, settings:{level:0.55}};
    case 'mixer': return {id, kind, settings:{levelA:0.5, levelB:0.5}};
    case 'output': return {id, kind, settings:{level:0.7}};
  }
}

export function createExamplePatch(): Patch {
  const drone = createDefaultDroneSettings();
  return {
    version:1,
    modules:[
      {id:'drone', kind:'drone', settings:{voice:{...drone, gain:0.24,
        oscillators:drone.oscillators.map((oscillator, index) => ({...oscillator,
          enabled:index < 3, waveform:index === 1 ? 'sawtooth' : 'triangle',
          frequencyHz:[110, 164.81, 220.4, 330, 440][index], volume:0.65,
          pan:[-0.3, 0.2, 0.4, 0, 0][index]}))}}},
      createPatchModule('filter','filter'), createPatchModule('gain','gain'),
      createPatchModule('output','output'), createPatchModule('automation','automation')
    ],
    cables:[
      {id:'drone-filter', source:{moduleId:'drone',portId:'out'}, destination:{moduleId:'filter',portId:'in'}},
      {id:'filter-gain', source:{moduleId:'filter',portId:'out'}, destination:{moduleId:'gain',portId:'in'}},
      {id:'gain-output', source:{moduleId:'gain',portId:'out'}, destination:{moduleId:'output',portId:'in'}},
      {id:'filter-control', source:{moduleId:'automation',portId:'control'}, destination:{moduleId:'filter',portId:'cutoff'}, mapping:{from:180,to:2400}},
      {id:'gain-control', source:{moduleId:'automation',portId:'control'}, destination:{moduleId:'gain',portId:'level'}, mapping:{from:0.08,to:0.7}}
    ]
  };
}
