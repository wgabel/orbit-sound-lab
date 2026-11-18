export type HarmonyMode = 'free' | 'natural' | 'piano';
export type HarmonyChord = 'minor' | 'major' | 'fifth' | 'ambient';
export interface HarmonySettings {
  readonly mode: HarmonyMode;
  readonly chord: HarmonyChord;
  readonly rootFrequencyHz: number;
  readonly spreadCents: number;
}
export const DEFAULT_HARMONY_SETTINGS: HarmonySettings = {mode:'free',chord:'minor',rootFrequencyHz:110,spreadCents:0};
const RATIOS: Record<HarmonyChord,readonly number[]> = {
  minor:[1, 6/5, 3/2, 2, 12/5],
  major:[1, 5/4, 3/2, 2, 5/2],
  fifth:[1, 3/2, 2, 3, 4],
  ambient:[1, 9/8, 3/2, 2, 3]
};
export function validateHarmonySettings(settings: HarmonySettings): void {
  if (!['free','natural','piano'].includes(settings.mode) || !Object.hasOwn(RATIOS,settings.chord)) throw new Error('Invalid harmony mode or chord.');
  if (!Number.isFinite(settings.rootFrequencyHz) || settings.rootFrequencyHz < 55 || settings.rootFrequencyHz > 220) throw new Error('Root frequency must be 55–220 Hz.');
  if (!Number.isFinite(settings.spreadCents) || settings.spreadCents < 0 || settings.spreadCents > 20) throw new Error('Spread must be 0–20 cents.');
}
export function getHarmonicFrequency(settings: HarmonySettings, oscillatorIndex: number): number {
  validateHarmonySettings(settings);
  if (settings.mode === 'free') throw new Error('Free mode has no harmonic frequency.');
  if (!Number.isInteger(oscillatorIndex) || oscillatorIndex < 0 || oscillatorIndex > 4) throw new Error('Invalid oscillator index.');
  const ratio = RATIOS[settings.chord][oscillatorIndex];
  const tunedRatio = settings.mode === 'piano' ? Math.pow(2,Math.round(12*Math.log2(ratio))/12) : ratio;
  const spread = settings.spreadCents * (oscillatorIndex - 2) / 2;
  return settings.rootFrequencyHz * tunedRatio * Math.pow(2,spread/1200);
}
export function getRandomHarmonicFrequency(settings: HarmonySettings): number {
  const index = Math.floor(Math.random()*5);
  return getHarmonicFrequency(settings,index);
}

/** Derive the audible pitch without modifying the oscillator's saved source frequency. */
export function getEffectiveOscillatorFrequency(settings: HarmonySettings, sourceFrequencyHz: number, oscillatorIndex: number): number {
  if (settings.mode === 'free') return sourceFrequencyHz;
  if (!Number.isFinite(sourceFrequencyHz) || sourceFrequencyHz <= 0) throw new Error('Invalid source frequency.');
  validateHarmonySettings(settings);
  const root = settings.rootFrequencyHz;
  const candidates: number[] = [];
  for (const ratio of RATIOS[settings.chord]) {
    const tunedRatio = settings.mode === 'piano' ? Math.pow(2, Math.round(12 * Math.log2(ratio)) / 12) : ratio;
    for (let octave = -3; octave <= 5; octave++) {
      const candidate = root * tunedRatio * Math.pow(2, octave);
      if (candidate >= 20 && candidate <= 20000) candidates.push(candidate);
    }
  }
  const closest = candidates.reduce((best, candidate) =>
    Math.abs(Math.log2(candidate / sourceFrequencyHz)) < Math.abs(Math.log2(best / sourceFrequencyHz)) ? candidate : best);
  const spread = settings.spreadCents * (oscillatorIndex - 2) / 2;
  return Math.min(20000, Math.max(20, closest * Math.pow(2, spread / 1200)));
}
