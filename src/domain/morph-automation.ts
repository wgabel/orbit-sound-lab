export interface MorphAutomationSettings {
  readonly durationSeconds: number;
  readonly loop: boolean;
}

export const MIN_MORPH_DURATION_SECONDS = 0.5;
export const MAX_MORPH_DURATION_SECONDS = 600;

export function validateMorphAutomation({durationSeconds}: MorphAutomationSettings): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_MORPH_DURATION_SECONDS ||
      durationSeconds > MAX_MORPH_DURATION_SECONDS) {
    throw new Error('Morph duration must be between 0.5 and 600 seconds.');
  }
}

export function getMorphAutomationProgress(settings: MorphAutomationSettings, elapsedSeconds: number) {
  const legs = Math.max(0, elapsedSeconds) / settings.durationSeconds;
  if (!settings.loop) return {position: Math.min(1, legs), running: legs < 1};
  const phase = legs % 2;
  return {position: 1 - Math.abs(1 - phase), running: true};
}
