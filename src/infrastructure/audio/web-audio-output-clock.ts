interface AudioOutputClock {
  readonly currentTime: number;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  getOutputTimestamp?(): AudioTimestamp;
}

function reportedLatency(seconds: number | undefined): number {
  return seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export function readOutputContextTime(context: AudioOutputClock, now: number): number {
  const timestamp = context.getOutputTimestamp?.();
  const {contextTime, performanceTime} = timestamp ?? {};
  if (contextTime !== undefined && performanceTime !== undefined && Number.isFinite(contextTime) &&
      contextTime >= 0 && Number.isFinite(performanceTime) && performanceTime > 0) {
    const outputTime = contextTime + (now - performanceTime) / 1000;
    return Math.max(0, Math.min(context.currentTime, outputTime));
  }
  return Math.max(0, context.currentTime - reportedLatency(context.baseLatency) - reportedLatency(context.outputLatency));
}
