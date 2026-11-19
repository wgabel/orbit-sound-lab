import { OSCILLATORS_PER_DRONE, validateDroneSettings } from './drone';
import type { OscillatorSettings } from './drone';
import type { DroneLayer } from './drone-layers';
import { createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from './modulation';
import type { LowFrequencyOscillatorSettings } from './modulation';
import type { OscillatorModulationParameter } from './oscillator-modulation';

type OscillatorSlot = 1 | 2 | 3 | 4 | 5;

interface OscillatorBankRoute {
  readonly sourceSlot: OscillatorSlot;
  readonly targetSlot: OscillatorSlot;
  readonly parameter: OscillatorModulationParameter;
  readonly depth: number;
}

interface BankOscillator extends Pick<OscillatorSettings, 'waveform' | 'frequencyHz' | 'volume' | 'pan' | 'shape'> {
  readonly cutoffHz?: number;
  readonly detuneCents?: number;
  readonly movement?: Pick<LowFrequencyOscillatorSettings, 'destination' | 'frequencyHz'> &
    Partial<Pick<LowFrequencyOscillatorSettings, 'depthAmplitude' | 'depthHz' | 'depthShape'>>;
}

interface OscillatorBank {
  readonly id: string;
  readonly name: string;
  readonly routes?: readonly OscillatorBankRoute[];
  readonly oscillators: readonly [BankOscillator, BankOscillator, BankOscillator, BankOscillator, BankOscillator];
}

const banks = [
  {
    id: 'open-fifths', name: 'Open Fifths',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.68, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 82.5, volume: 0.32, pan: -0.35, cutoffHz: 580},
      {waveform: 'triangle', frequencyHz: 110, volume: 0.26, pan: 0.32, cutoffHz: 850},
      {waveform: 'sineTriangle', frequencyHz: 165, volume: 0.13, pan: -0.65, shape: 0.29,
        movement: {destination: 'shape', frequencyHz: 0.055, depthShape: 0.24}},
      {waveform: 'sine', frequencyHz: 220, volume: 0.09, pan: 0.64}
    ]
  },
  {
    id: 'amber-glow', name: 'Amber Glow',
    oscillators: [
      {waveform: 'triangle', frequencyHz: 65.4064, volume: 0.62, pan: 0, cutoffHz: 520},
      {waveform: 'sineTriangle', frequencyHz: 81.758, volume: 0.32, pan: -0.34, shape: 0.42},
      {waveform: 'sawtooth', frequencyHz: 98.1096, volume: 0.27, pan: 0.38, cutoffHz: 410},
      {waveform: 'triangle', frequencyHz: 130.8128, volume: 0.17, pan: -0.56,
        movement: {destination: 'amplitude', frequencyHz: 0.042, depthAmplitude: 0.07}},
      {waveform: 'sine', frequencyHz: 163.516, volume: 0.13, pan: 0.58}
    ]
  },
  {
    id: 'midnight-tide', name: 'Midnight Tide',
    oscillators: [
      {waveform: 'sine', frequencyHz: 73.4162, volume: 0.7, pan: 0},
      {waveform: 'triangle', frequencyHz: 88.09944, volume: 0.31, pan: -0.39, cutoffHz: 650},
      {waveform: 'square', frequencyHz: 110.1243, volume: 0.25, pan: 0.34, cutoffHz: 430,
        movement: {destination: 'filterCutoff', frequencyHz: 0.05, depthHz: 125}},
      {waveform: 'sineTriangle', frequencyHz: 146.8324, volume: 0.18, pan: -0.57, shape: 0.26,
        movement: {destination: 'shape', frequencyHz: 0.035, depthShape: 0.18}},
      {waveform: 'sine', frequencyHz: 176.19888, volume: 0.12, pan: 0.62}
    ]
  },
  {
    id: 'glass-harbor', name: 'Glass Harbor',
    oscillators: [
      {waveform: 'sine', frequencyHz: 82.4069, volume: 0.63, pan: 0},
      {waveform: 'sine', frequencyHz: 92.7077625, volume: 0.2, pan: -0.46},
      {waveform: 'triangle', frequencyHz: 123.61035, volume: 0.3, pan: 0.42},
      {waveform: 'sineTriangle', frequencyHz: 164.8138, volume: 0.2, pan: -0.68, shape: 0.55,
        movement: {destination: 'shape', frequencyHz: 0.068, depthShape: 0.28}},
      {waveform: 'triangle', frequencyHz: 247.2207, volume: 0.17, pan: 0.71,
        movement: {destination: 'amplitude', frequencyHz: 0.081, depthAmplitude: 0.08}}
    ]
  },
  {
    id: 'soft-orbit', name: 'Soft Orbit',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.67, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 110, volume: 0.35, pan: -0.58, detuneCents: -5, shape: 0.18,
        movement: {destination: 'shape', frequencyHz: 0.032, depthShape: 0.14}},
      {waveform: 'sineTriangle', frequencyHz: 110, volume: 0.35, pan: 0.58, detuneCents: 5, shape: 0.7,
        movement: {destination: 'shape', frequencyHz: 0.047, depthShape: 0.22}},
      {waveform: 'triangle', frequencyHz: 165, volume: 0.17, pan: -0.33, cutoffHz: 740},
      {waveform: 'sine', frequencyHz: 220, volume: 0.1, pan: 0.34,
        movement: {destination: 'amplitude', frequencyHz: 0.073, depthAmplitude: 0.06}}
    ]
  },
  {
    id: 'velvet-current', name: 'Velvet Current',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.54, pan: 0},
      {waveform: 'sine', frequencyHz: 82.5, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 165, volume: 0.36, pan: -0.3},
      {waveform: 'triangle', frequencyHz: 110, volume: 0.23, pan: 0.34, cutoffHz: 490},
      {waveform: 'sine', frequencyHz: 220, volume: 0.15, pan: 0.62,
        movement: {destination: 'amplitude', frequencyHz: 0.06, depthAmplitude: 0.10}}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 30}]
  },
  {
    id: 'glass-bell', name: 'Glass Bell',
    oscillators: [
      {waveform: 'sine', frequencyHz: 62.5, volume: 0.44, pan: 0},
      {waveform: 'sine', frequencyHz: 218.75, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 312.5, volume: 0.32, pan: 0.41,
        movement: {destination: 'amplitude', frequencyHz: 0.085, depthAmplitude: 0.12}},
      {waveform: 'triangle', frequencyHz: 125, volume: 0.22, pan: -0.29, cutoffHz: 650},
      {waveform: 'sine', frequencyHz: 187.5, volume: 0.14, pan: -0.57}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 160}]
  },
  {
    id: 'cascade-drift', name: 'Cascade Drift',
    oscillators: [
      {waveform: 'sine', frequencyHz: 65.4, volume: 0.51, pan: 0},
      {waveform: 'sine', frequencyHz: 65.4, volume: 0, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 130.8, volume: 0.22, pan: -0.45, shape: 0.25,
        movement: {destination: 'shape', frequencyHz: 0.045, depthShape: 0.22}},
      {waveform: 'sine', frequencyHz: 196.2, volume: 0.29, pan: 0.45},
      {waveform: 'triangle', frequencyHz: 261.6, volume: 0.13, pan: -0.61, cutoffHz: 860}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 46},
      {sourceSlot: 3, targetSlot: 4, parameter: 'frequency', depth: 105}
    ]
  },
  {
    id: 'copper-pulse', name: 'Copper Pulse',
    oscillators: [
      {waveform: 'sine', frequencyHz: 60, volume: 0.52, pan: 0},
      {waveform: 'sine', frequencyHz: 90, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 270, volume: 0.28, pan: 0.3},
      {waveform: 'triangle', frequencyHz: 120, volume: 0.24, pan: -0.42, cutoffHz: 620},
      {waveform: 'sineTriangle', frequencyHz: 360, volume: 0.1, pan: -0.57, shape: 0.35,
        movement: {destination: 'shape', frequencyHz: 0.052, depthShape: 0.28}}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'volume', depth: 0.25}]
  },
  {
    id: 'breathing-reed', name: 'Breathing Reed',
    oscillators: [
      {waveform: 'sine', frequencyHz: 73.4, volume: 0.46, pan: 0},
      {waveform: 'sine', frequencyHz: 73.4, volume: 0, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 146.8, volume: 0.29, pan: -0.37, cutoffHz: 460,
        movement: {destination: 'filterCutoff', frequencyHz: 0.048, depthHz: 95}},
      {waveform: 'triangle', frequencyHz: 110.1, volume: 0.24, pan: 0.42, cutoffHz: 700},
      {waveform: 'sine', frequencyHz: 293.6, volume: 0.12, pan: 0.58}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'cutoff', depth: 320}]
  }
] satisfies readonly OscillatorBank[];

export const builtInOscillatorBanks: readonly Pick<OscillatorBank, 'id' | 'name'>[] = banks;

export function loadBuiltInOscillatorBank(presetId: string, layer: DroneLayer): DroneLayer {
  const preset: OscillatorBank | undefined = banks.find(item => item.id === presetId);
  if (!preset) throw new Error('Unknown oscillator bank.');
  if (layer.drone.oscillators.length !== OSCILLATORS_PER_DRONE) throw new Error('An oscillator bank requires five slots.');

  const oscillators = layer.drone.oscillators.map((target, index) => {
    const {cutoffHz, movement: _movement, detuneCents = 0, ...settings} = preset.oscillators[index];
    return {...settings, id: target.id, fade: target.fade, enabled: true, detuneCents,
      filter: {enabled: cutoffHz !== undefined, cutoffHz: cutoffHz ?? 2400, resonance: 0.7}};
  });
  const movementById = new Map(oscillators.map((oscillator, index) => [oscillator.id, preset.oscillators[index].movement]));
  const modulation = createDefaultLowFrequencyOscillators(oscillators.map(oscillator => oscillator.id)).map(settings => {
    const movement = movementById.get(settings.targetOscillatorId);
    return movement?.destination === settings.destination ? {...settings, ...movement, enabled: true} : settings;
  });
  const oscillatorModulations = (preset.routes ?? []).map(({sourceSlot, targetSlot, parameter, depth}) => ({
    sourceId: oscillators[sourceSlot - 1].id,
    targetId: oscillators[targetSlot - 1].id,
    parameter,
    depth,
    signal: 'waveform' as const,
    enabled: true
  }));
  const drone = {...layer.drone, oscillators, oscillatorModulations};
  validateDroneSettings(drone);
  for (const settings of modulation) validateLowFrequencyOscillatorSettings(settings);
  // Free tuning plays the bank's exact voicing even if the previous patch used a different harmony.
  return {...layer, drone, modulation, harmony: {...layer.harmony, mode: 'free'}};
}
