import type { DelaySettings } from './delay';
import type { DroneLayer, DroneLayerId } from './drone-layers';
import { DEFAULT_HARMONY_SETTINGS, getEffectiveOscillatorFrequency } from './harmony';
import type { PerformancePosition } from './performance-pad';
import { NEUTRAL_PERFORMANCE_POSITION } from './performance-pad';
import type { SoundPreset } from './preset-library';

export interface SoundScene {
  readonly layers: Readonly<Record<DroneLayerId, DroneLayer>>;
  readonly masterGain: number;
  readonly delay: DelaySettings;
  readonly performancePosition: PerformancePosition;
}

export interface ArrangementScene {
  readonly sound: SoundScene;
  readonly holdSeconds: number;
  readonly blendSeconds: number;
}

export const ARRANGEMENT_FADE_IN_SECONDS = 5;
export const ARRANGEMENT_FADE_OUT_SECONDS = 8;
export const ARRANGEMENT_TAIL_SECONDS = 2;
export const MAX_SCENE_DURATION_SECONDS = 600;

export function sceneFromPreset(preset: SoundPreset): SoundScene {
  return {
    layers: {
      A: {drone: preset.drone, modulation: preset.modulation,
        harmony: preset.harmony ?? DEFAULT_HARMONY_SETTINGS, enabled: preset.layerMix.firstLayerEnabled},
      B: preset.layerMix.secondLayer
    },
    masterGain: preset.layerMix.masterGain,
    delay: preset.delay,
    performancePosition: NEUTRAL_PERFORMANCE_POSITION
  };
}

export function tuneSceneLayer(layer: DroneLayer) {
  return {...layer.drone, oscillators: layer.drone.oscillators.map((oscillator, index) => ({
    ...oscillator, frequencyHz: getEffectiveOscillatorFrequency(layer.harmony, oscillator.frequencyHz, index)
  }))};
}

/** Linear stereo crossfade keeps the sum of the two gains at unity, even for identical patches. */
export function sceneBlendGains(position: number): readonly [number, number] {
  if (!Number.isFinite(position) || position < 0 || position > 1) {
    throw new Error('Blend position must be between 0 and 1.');
  }
  return [1 - position, position];
}

export function getArrangementDuration(scenes: readonly ArrangementScene[]): number {
  if (!scenes.length) return 0;
  return ARRANGEMENT_FADE_IN_SECONDS + ARRANGEMENT_FADE_OUT_SECONDS + ARRANGEMENT_TAIL_SECONDS +
    scenes.reduce((duration, scene, index) =>
      duration + scene.holdSeconds + (index === scenes.length - 1 ? 0 : scene.blendSeconds), 0);
}

function isSceneDurationValid(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_SCENE_DURATION_SECONDS;
}

export function hasValidArrangementTimes(scenes: readonly ArrangementScene[]): boolean {
  return scenes.every((scene, index) => isSceneDurationValid(scene.holdSeconds) &&
    (index === scenes.length - 1 || isSceneDurationValid(scene.blendSeconds)));
}

export function validateArrangement(scenes: readonly ArrangementScene[]): void {
  if (!scenes.length) throw new Error('Capture a scene before playing the arrangement.');
  if (!hasValidArrangementTimes(scenes)) throw new Error('Scene times must be between 0 and 600 seconds.');
}
