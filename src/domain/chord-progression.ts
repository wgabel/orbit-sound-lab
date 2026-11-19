import { CHORD_TYPES, getMaximumChordInversion, MAXIMUM_CHORD_ROOT, MINIMUM_CHORD_ROOT } from './chord';
import type { ChordSettings } from './chord';

export type ChordStep = Pick<ChordSettings, 'rootNote' | 'chord'>;
export interface ChordProgression {
  readonly stepSeconds: number;
  readonly mode: 'loop' | 'once';
  readonly steps: readonly ChordStep[];
}

export const MAXIMUM_CHORD_STEPS = 16;
export const DEFAULT_CHORD_PROGRESSION: ChordProgression = {
  stepSeconds:2, mode:'loop',
  steps:[{rootNote:48,chord:'minor'},{rootNote:56,chord:'major'},
    {rootNote:51,chord:'major'},{rootNote:58,chord:'major'}]
};

export function validateChordProgression(settings: ChordProgression): void {
  if (!Number.isFinite(settings.stepSeconds) || settings.stepSeconds < 0.1 || settings.stepSeconds > 30 ||
    (settings.mode !== 'loop' && settings.mode !== 'once') || !Array.isArray(settings.steps) ||
    settings.steps.length < 1 || settings.steps.length > MAXIMUM_CHORD_STEPS ||
    settings.steps.some(step => !step || !Number.isInteger(step.rootNote) || step.rootNote < MINIMUM_CHORD_ROOT ||
      step.rootNote > MAXIMUM_CHORD_ROOT || !CHORD_TYPES.includes(step.chord))) {
    throw new Error('Chord Progression needs 1–16 valid chords and a step length of 0.1–30 seconds.');
  }
}

export function voiceProgressionStep(settings: ChordSettings, step: ChordStep): ChordSettings {
  return {...settings,rootNote:step.rootNote,chord:step.chord,inversion:Math.min(settings.inversion,getMaximumChordInversion(step.chord))};
}
