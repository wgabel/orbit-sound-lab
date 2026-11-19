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

type BankMovement = Pick<LowFrequencyOscillatorSettings, 'destination' | 'frequencyHz'> &
  Partial<Pick<LowFrequencyOscillatorSettings, 'depthAmplitude' | 'depthCents' | 'depthHz' | 'depthShape' |
    'waveform' | 'sync' | 'phaseDegrees'>>;

interface BankOscillator extends Pick<OscillatorSettings, 'waveform' | 'frequencyHz' | 'volume' | 'pan' | 'shape'> {
  readonly cutoffHz?: number;
  readonly detuneCents?: number;
  readonly movements?: readonly BankMovement[];
}

interface OscillatorBank {
  readonly id: string;
  readonly name: string;
  readonly routes?: readonly OscillatorBankRoute[];
  readonly oscillators: readonly [BankOscillator, BankOscillator, BankOscillator, BankOscillator, BankOscillator];
}

const droneBanks = [
  {
    id: 'open-fifths', name: 'Open Fifths',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.68, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 82.5, volume: 0.32, pan: -0.35, cutoffHz: 580},
      {waveform: 'triangle', frequencyHz: 110, volume: 0.26, pan: 0.32, cutoffHz: 850},
      {waveform: 'sineTriangle', frequencyHz: 165, volume: 0.13, pan: -0.65, shape: 0.29,
        movements: [{destination: 'shape', frequencyHz: 0.055, depthShape: 0.24}]},
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
        movements: [{destination: 'amplitude', frequencyHz: 0.042, depthAmplitude: 0.07}]},
      {waveform: 'sine', frequencyHz: 163.516, volume: 0.13, pan: 0.58}
    ]
  },
  {
    id: 'midnight-tide', name: 'Midnight Tide',
    oscillators: [
      {waveform: 'sine', frequencyHz: 73.4162, volume: 0.7, pan: 0},
      {waveform: 'triangle', frequencyHz: 88.09944, volume: 0.31, pan: -0.39, cutoffHz: 650},
      {waveform: 'square', frequencyHz: 110.1243, volume: 0.25, pan: 0.34, cutoffHz: 430,
        movements: [{destination: 'filterCutoff', frequencyHz: 0.05, depthHz: 125}]},
      {waveform: 'sineTriangle', frequencyHz: 146.8324, volume: 0.18, pan: -0.57, shape: 0.26,
        movements: [{destination: 'shape', frequencyHz: 0.035, depthShape: 0.18}]},
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
        movements: [{destination: 'shape', frequencyHz: 0.068, depthShape: 0.28}]},
      {waveform: 'triangle', frequencyHz: 247.2207, volume: 0.17, pan: 0.71,
        movements: [{destination: 'amplitude', frequencyHz: 0.081, depthAmplitude: 0.08}]}
    ]
  },
  {
    id: 'soft-orbit', name: 'Soft Orbit',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.67, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 110, volume: 0.35, pan: -0.58, detuneCents: -5, shape: 0.18,
        movements: [{destination: 'shape', frequencyHz: 0.032, depthShape: 0.14}]},
      {waveform: 'sineTriangle', frequencyHz: 110, volume: 0.35, pan: 0.58, detuneCents: 5, shape: 0.7,
        movements: [{destination: 'shape', frequencyHz: 0.047, depthShape: 0.22}]},
      {waveform: 'triangle', frequencyHz: 165, volume: 0.17, pan: -0.33, cutoffHz: 740},
      {waveform: 'sine', frequencyHz: 220, volume: 0.1, pan: 0.34,
        movements: [{destination: 'amplitude', frequencyHz: 0.073, depthAmplitude: 0.06}]}
    ]
  }
] satisfies readonly OscillatorBank[];

const crossModulationBanks = [
  {
    id: 'velvet-current', name: 'Velvet Current',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.54, pan: 0},
      {waveform: 'sine', frequencyHz: 82.5, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 165, volume: 0.36, pan: -0.3},
      {waveform: 'triangle', frequencyHz: 110, volume: 0.23, pan: 0.34, cutoffHz: 490},
      {waveform: 'sine', frequencyHz: 220, volume: 0.15, pan: 0.62,
        movements: [{destination: 'amplitude', frequencyHz: 0.06, depthAmplitude: 0.10}]}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 30}]
  },
  {
    id: 'glass-bell', name: 'Glass Bell',
    oscillators: [
      {waveform: 'sine', frequencyHz: 62.5, volume: 0.44, pan: 0},
      {waveform: 'sine', frequencyHz: 218.75, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 312.5, volume: 0.32, pan: 0.41,
        movements: [{destination: 'amplitude', frequencyHz: 0.085, depthAmplitude: 0.12}]},
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
        movements: [{destination: 'shape', frequencyHz: 0.045, depthShape: 0.22}]},
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
        movements: [{destination: 'shape', frequencyHz: 0.052, depthShape: 0.28}]}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'volume', depth: 0.25}]
  },
  {
    id: 'breathing-reed', name: 'Breathing Reed',
    oscillators: [
      {waveform: 'sine', frequencyHz: 73.4, volume: 0.46, pan: 0},
      {waveform: 'sine', frequencyHz: 73.4, volume: 0, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 146.8, volume: 0.29, pan: -0.37, cutoffHz: 460,
        movements: [{destination: 'filterCutoff', frequencyHz: 0.048, depthHz: 95}]},
      {waveform: 'triangle', frequencyHz: 110.1, volume: 0.24, pan: 0.42, cutoffHz: 700},
      {waveform: 'sine', frequencyHz: 293.6, volume: 0.12, pan: 0.58}
    ],
    routes: [{sourceSlot: 2, targetSlot: 3, parameter: 'cutoff', depth: 320}]
  }
] satisfies readonly OscillatorBank[];

const routingExampleBanks = [
  {
    id: 'ion-choir', name: 'Ion Choir',
    oscillators: [
      {waveform: 'sine', frequencyHz: 51.5625, volume: 0.34, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 103.125, volume: 0, pan: 0, shape: 0.2,
        movements: [{destination: 'shape', frequencyHz: 0.045, depthShape: 0.18}]},
      {waveform: 'sine', frequencyHz: 206.25, volume: 0.44, pan: -0.64},
      {waveform: 'sine', frequencyHz: 309.375, volume: 0.35, pan: 0.64},
      {waveform: 'triangle', frequencyHz: 154.6875, volume: 0.13, pan: 0, cutoffHz: 590}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 102},
      {sourceSlot: 2, targetSlot: 4, parameter: 'frequency', depth: 155}
    ]
  },
  {
    id: 'relay-bells', name: 'Relay Bells',
    oscillators: [
      {waveform: 'sine', frequencyHz: 70, volume: 0.34, pan: 0},
      {waveform: 'sine', frequencyHz: 70, volume: 0, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 117.5, volume: 0, pan: 0, shape: 0.22,
        movements: [{destination: 'shape', frequencyHz: 0.063, depthShape: 0.18}]},
      {waveform: 'sine', frequencyHz: 262.5, volume: 0.43, pan: -0.45},
      {waveform: 'sine', frequencyHz: 437.5, volume: 0.31, pan: 0.61}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 3, parameter: 'frequency', depth: 65},
      {sourceSlot: 3, targetSlot: 4, parameter: 'frequency', depth: 145},
      {sourceSlot: 4, targetSlot: 5, parameter: 'frequency', depth: 180}
    ]
  },
  {
    id: 'split-pulse', name: 'Split Pulse',
    oscillators: [
      {waveform: 'sine', frequencyHz: 85, volume: 0.31, pan: 0},
      {waveform: 'sine', frequencyHz: 85, volume: 0, pan: 0},
      {waveform: 'triangle', frequencyHz: 107.5, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 255, volume: 0.36, pan: -0.83},
      {waveform: 'sine', frequencyHz: 322.5, volume: 0.36, pan: 0.83}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 4, parameter: 'volume', depth: 0.34},
      {sourceSlot: 3, targetSlot: 5, parameter: 'volume', depth: 0.34}
    ]
  },
  {
    id: 'reed-reactor', name: 'Reed Reactor',
    oscillators: [
      {waveform: 'sine', frequencyHz: 52, volume: 0.29, pan: 0},
      {waveform: 'sine', frequencyHz: 78, volume: 0, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 156, volume: 0.44, pan: -0.68, cutoffHz: 300},
      {waveform: 'square', frequencyHz: 234, volume: 0.36, pan: 0.65, cutoffHz: 420,
        movements: [{destination: 'filterCutoff', frequencyHz: 0.051, depthHz: 65}]},
      {waveform: 'sine', frequencyHz: 312, volume: 0.22, pan: 0.14}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 3, parameter: 'cutoff', depth: 270},
      {sourceSlot: 2, targetSlot: 4, parameter: 'cutoff', depth: 360},
      {sourceSlot: 2, targetSlot: 5, parameter: 'frequency', depth: 110}
    ]
  },
  {
    id: 'prism-gate', name: 'Prism Gate',
    oscillators: [
      {waveform: 'sine', frequencyHz: 67.5, volume: 0.31, pan: 0},
      {waveform: 'sine', frequencyHz: 90, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 112.5, volume: 0, pan: 0},
      {waveform: 'sine', frequencyHz: 270, volume: 0.4, pan: -0.55},
      {waveform: 'sawtooth', frequencyHz: 202.5, volume: 0.35, pan: 0.62, cutoffHz: 390}
    ],
    routes: [
      {sourceSlot: 2, targetSlot: 4, parameter: 'frequency', depth: 112},
      {sourceSlot: 3, targetSlot: 4, parameter: 'volume', depth: 0.36},
      {sourceSlot: 4, targetSlot: 5, parameter: 'cutoff', depth: 330}
    ]
  }
] satisfies readonly OscillatorBank[];

function squareMovements(frequencyHz: number, phaseDegrees: number,
  ...destinations: Omit<BankMovement, 'frequencyHz' | 'phaseDegrees' | 'waveform' | 'sync'>[]): BankMovement[] {
  return destinations.map(destination => ({...destination, frequencyHz, phaseDegrees, waveform: 'square', sync: true}));
}

const steppedDroneBanks = [
  {
    id: 'lockstep-bloom', name: 'Lockstep Bloom',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.4, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 110, volume: 0.43, pan: -0.38, cutoffHz: 820,
        movements: squareMovements(0.25, 0, {destination: 'amplitude', depthAmplitude: 0.44},
          {destination: 'filterCutoff', depthHz: 700})},
      {waveform: 'triangle', frequencyHz: 165, volume: 0.27, pan: 0.47, cutoffHz: 820,
        movements: squareMovements(0.25, 0, {destination: 'amplitude', depthAmplitude: 0.37},
          {destination: 'filterCutoff', depthHz: 650})},
      {waveform: 'sine', frequencyHz: 220, volume: 0.11, pan: -0.58},
      {waveform: 'sine', frequencyHz: 330, volume: 0.07, pan: 0.61}
    ]
  },
  {
    id: 'stereo-relay', name: 'Stereo Relay',
    oscillators: [
      {waveform: 'sine', frequencyHz: 65, volume: 0.34, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 130, volume: 0.41, pan: -0.85, cutoffHz: 720,
        movements: squareMovements(0.4, 0, {destination: 'amplitude', depthAmplitude: 0.5},
          {destination: 'filterCutoff', depthHz: 620})},
      {waveform: 'triangle', frequencyHz: 195, volume: 0.39, pan: 0.85, cutoffHz: 940,
        movements: squareMovements(0.4, 180, {destination: 'amplitude', depthAmplitude: 0.5},
          {destination: 'filterCutoff', depthHz: 730})},
      {waveform: 'sine', frequencyHz: 260, volume: 0.10, pan: -0.45,
        movements: squareMovements(0.4, 0, {destination: 'amplitude', depthAmplitude: 0.47})},
      {waveform: 'sine', frequencyHz: 325, volume: 0.10, pan: 0.45,
        movements: squareMovements(0.4, 180, {destination: 'amplitude', depthAmplitude: 0.47})}
    ]
  },
  {
    id: 'four-windows', name: 'Four Windows',
    oscillators: [
      {waveform: 'sine', frequencyHz: 60, volume: 0.37, pan: 0},
      {waveform: 'triangle', frequencyHz: 120, volume: 0.33, pan: -0.69,
        movements: squareMovements(0.25, 0, {destination: 'amplitude', depthAmplitude: 0.5})},
      {waveform: 'sawtooth', frequencyHz: 180, volume: 0.26, pan: -0.23, cutoffHz: 970,
        movements: squareMovements(0.25, 90, {destination: 'amplitude', depthAmplitude: 0.5},
          {destination: 'filterCutoff', depthHz: 710})},
      {waveform: 'triangle', frequencyHz: 240, volume: 0.20, pan: 0.28,
        movements: squareMovements(0.25, 180, {destination: 'amplitude', depthAmplitude: 0.5})},
      {waveform: 'sineTriangle', frequencyHz: 300, volume: 0.17, pan: 0.72, shape: 0.36,
        movements: squareMovements(0.25, 270, {destination: 'amplitude', depthAmplitude: 0.5})}
    ]
  },
  {
    id: 'three-over-two', name: 'Three Over Two',
    oscillators: [
      {waveform: 'sine', frequencyHz: 72, volume: 0.39, pan: 0},
      {waveform: 'sawtooth', frequencyHz: 144, volume: 0.36, pan: -0.58, cutoffHz: 900,
        movements: squareMovements(0.25, 0, {destination: 'amplitude', depthAmplitude: 0.48},
          {destination: 'filterCutoff', depthHz: 720})},
      {waveform: 'triangle', frequencyHz: 216, volume: 0.32, pan: 0.63,
        movements: squareMovements(0.375, 0, {destination: 'amplitude', depthAmplitude: 0.48})},
      {waveform: 'sineTriangle', frequencyHz: 288, volume: 0.14, pan: -0.22, shape: 0.42,
        movements: squareMovements(0.125, 180, {destination: 'amplitude', depthAmplitude: 0.46})},
      {waveform: 'sine', frequencyHz: 360, volume: 0.08, pan: 0.41}
    ]
  },
  {
    id: 'register-switch', name: 'Register Switch',
    oscillators: [
      {waveform: 'sine', frequencyHz: 55, volume: 0.42, pan: 0},
      {waveform: 'sineTriangle', frequencyHz: 269.3, volume: 0.31, pan: -0.28, shape: 0.49, cutoffHz: 960,
        movements: squareMovements(0.2, 0, {destination: 'pitch', depthCents: 350},
          {destination: 'filterCutoff', depthHz: 690}, {destination: 'shape', depthShape: 0.43})},
      {waveform: 'triangle', frequencyHz: 165, volume: 0.28, pan: 0.57,
        movements: squareMovements(0.2, 180, {destination: 'amplitude', depthAmplitude: 0.5})},
      {waveform: 'sine', frequencyHz: 110, volume: 0.18, pan: -0.43},
      {waveform: 'sine', frequencyHz: 440, volume: 0.10, pan: 0.69,
        movements: squareMovements(0.2, 0, {destination: 'amplitude', depthAmplitude: 0.5})}
    ]
  }
] satisfies readonly OscillatorBank[];

export const oscillatorBankGroups: readonly {
  readonly label: string;
  readonly presets: readonly OscillatorBank[];
}[] = [
  {label: 'Drone Foundations', presets: droneBanks},
  {label: 'Cross-Modulation', presets: crossModulationBanks},
  {label: 'Routing Example', presets: routingExampleBanks},
  {label: 'Stepped Drones', presets: steppedDroneBanks}
];

const banks = oscillatorBankGroups.flatMap(group => group.presets);
export const builtInOscillatorBanks: readonly Pick<OscillatorBank, 'id' | 'name'>[] = banks;

export function loadBuiltInOscillatorBank(presetId: string, layer: DroneLayer): DroneLayer {
  const preset: OscillatorBank | undefined = banks.find(item => item.id === presetId);
  if (!preset) throw new Error('Unknown oscillator bank.');
  if (layer.drone.oscillators.length !== OSCILLATORS_PER_DRONE) throw new Error('An oscillator bank requires five slots.');

  const oscillators = layer.drone.oscillators.map((target, index) => {
    const {cutoffHz, movements: _movements, detuneCents = 0, ...settings} = preset.oscillators[index];
    return {...settings, id: target.id, fade: target.fade, enabled: true, detuneCents,
      filter: {enabled: cutoffHz !== undefined, cutoffHz: cutoffHz ?? 2400, resonance: 0.7}};
  });
  const movementsById = new Map(oscillators.map((oscillator, index) => [oscillator.id, preset.oscillators[index].movements]));
  const modulation = createDefaultLowFrequencyOscillators(oscillators.map(oscillator => oscillator.id)).map(settings => {
    const movement = movementsById.get(settings.targetOscillatorId)?.find(item => item.destination === settings.destination);
    return movement ? {...settings, ...movement, enabled: true} : settings;
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
