import { createDefaultDelaySettings, validateDelaySettings } from './delay';
import type { DelaySettings } from './delay';

export const DEFAULT_DRONE_EFFECT_ORDER = ['eq','overdrive','compressor','chorus','flanger','delay','reverb'] as const;
export type DroneEffectId = typeof DEFAULT_DRONE_EFFECT_ORDER[number];

export interface ChorusSettings {
  readonly enabled: boolean;
  readonly rateHz: number;
  readonly depthMilliseconds: number;
  readonly mix: number;
}

export interface FlangerSettings extends ChorusSettings {
  readonly feedback: number;
}

export interface OverdriveSettings {
  readonly enabled: boolean;
  readonly driveDecibels: number;
  readonly toneHz: number;
  readonly mix: number;
}

export interface CompressorSettings {
  readonly enabled: boolean;
  readonly thresholdDecibels: number;
  readonly ratio: number;
  readonly attackMilliseconds: number;
  readonly releaseMilliseconds: number;
}

export interface DroneEffectsSettings {
  readonly order?: readonly DroneEffectId[];
  readonly delay: DelaySettings;
  readonly chorus: ChorusSettings;
  readonly flanger: FlangerSettings;
  readonly eqEnabled: boolean;
  readonly overdrive: OverdriveSettings;
  readonly compressor: CompressorSettings;
}

export const DRONE_EFFECT_RANGES = {
  mix: {min:0,max:1},
  chorusRate: {min:0.05,max:4},
  chorusDepth: {min:0.5,max:10},
  flangerRate: {min:0.05,max:3},
  flangerDepth: {min:0.5,max:3.5},
  flangerFeedback: {min:0,max:0.75},
  drive: {min:0,max:24},
  tone: {min:500,max:12_000},
  threshold: {min:-60,max:0},
  ratio: {min:1,max:20},
  attack: {min:1,max:100},
  release: {min:20,max:1000}
} as const;

export const DEFAULT_DRONE_EFFECTS: DroneEffectsSettings = {
  delay: createDefaultDelaySettings(),
  chorus: {enabled:false,rateHz:0.35,depthMilliseconds:4,mix:0.35},
  flanger: {enabled:false,rateHz:0.2,depthMilliseconds:2.5,feedback:0.45,mix:0.5},
  eqEnabled: true,
  overdrive: {enabled:false,driveDecibels:14,toneHz:4500,mix:0.65},
  compressor: {enabled:false,thresholdDecibels:-24,ratio:4,attackMilliseconds:10,releaseMilliseconds:180}
};

export function moveDroneEffect(order: readonly DroneEffectId[], index: number, direction: -1 | 1): readonly DroneEffectId[] {
  const destination = index + direction;
  if (index < 0 || index >= order.length || destination < 0 || destination >= order.length) return order;
  const moved = [...order];
  [moved[index],moved[destination]] = [moved[destination],moved[index]];
  return moved;
}

type EffectRange = {readonly min:number; readonly max:number};

function isInRange(value: number, {min,max}: EffectRange): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function hasEnableSwitch(effect?: {readonly enabled: boolean}): boolean {
  return typeof effect?.enabled === 'boolean';
}

export function validateDroneEffects(settings: DroneEffectsSettings): void {
  const ranges = DRONE_EFFECT_RANGES;
  if (!settings || typeof settings.eqEnabled !== 'boolean') throw new Error('Invalid drone effects.');
  const {order} = settings;
  if (order !== undefined && (!Array.isArray(order) || order.length !== DEFAULT_DRONE_EFFECT_ORDER.length ||
      !DEFAULT_DRONE_EFFECT_ORDER.every(effect => order.includes(effect)))) {
    throw new Error('Drone effect order must include each effect exactly once.');
  }
  const {delay,chorus,flanger,overdrive,compressor} = settings;
  if (!hasEnableSwitch(delay)) throw new Error('Invalid drone delay.');
  validateDelaySettings(delay);
  if (!hasEnableSwitch(chorus) || !isInRange(chorus.rateHz,ranges.chorusRate) || !isInRange(chorus.depthMilliseconds,ranges.chorusDepth) ||
      !isInRange(chorus.mix,ranges.mix)) throw new Error('Invalid drone chorus.');
  if (!hasEnableSwitch(flanger) || !isInRange(flanger.rateHz,ranges.flangerRate) || !isInRange(flanger.depthMilliseconds,ranges.flangerDepth) ||
      !isInRange(flanger.feedback,ranges.flangerFeedback) || !isInRange(flanger.mix,ranges.mix)) throw new Error('Invalid drone flanger.');
  if (!hasEnableSwitch(overdrive) || !isInRange(overdrive.driveDecibels,ranges.drive) || !isInRange(overdrive.toneHz,ranges.tone) ||
      !isInRange(overdrive.mix,ranges.mix)) throw new Error('Invalid drone overdrive.');
  if (!hasEnableSwitch(compressor) || !isInRange(compressor.thresholdDecibels,ranges.threshold) || !isInRange(compressor.ratio,ranges.ratio) ||
      !isInRange(compressor.attackMilliseconds,ranges.attack) || !isInRange(compressor.releaseMilliseconds,ranges.release)) {
    throw new Error('Invalid drone compressor.');
  }
}
