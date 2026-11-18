export interface DelaySettings {
  readonly enabled: boolean;
  readonly timeSeconds: number;
  readonly feedback: number;
  readonly mix: number;
}
export function createDefaultDelaySettings(): DelaySettings {
  return {enabled: false, timeSeconds: 0.45, feedback: 0.35, mix: 0.25};
}
export function validateDelaySettings(settings: DelaySettings): void {
  if (!Number.isFinite(settings.timeSeconds) || settings.timeSeconds < 0.05 || settings.timeSeconds > 2) throw new Error('Delay time must be between 0.05 and 2 seconds.');
  if (!Number.isFinite(settings.feedback) || settings.feedback < 0 || settings.feedback > 0.85) throw new Error('Delay feedback must be between 0 and 0.85.');
  if (!Number.isFinite(settings.mix) || settings.mix < 0 || settings.mix > 1) throw new Error('Delay mix must be between 0 and 1.');
}
