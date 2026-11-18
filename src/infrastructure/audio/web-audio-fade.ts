export const PLAYBACK_FADE_SECONDS = 0.02;

export function fadeGain(parameter: AudioParam, target: number, now: number): void {
  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
  else {
    const currentValue = parameter.value;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(currentValue, now);
  }
  parameter.linearRampToValueAtTime(target, now + PLAYBACK_FADE_SECONDS);
}
