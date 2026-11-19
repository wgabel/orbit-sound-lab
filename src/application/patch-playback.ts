import type { Patch } from '../domain/patch';

export interface PatchPlayback {
  readonly sampleRate: number;
  start(patch: Patch): Promise<void>;
  update(patch: Patch): void;
  readAudibleElapsed(): number;
  readOutputLevel(): number;
  getWaveformAnalyser(moduleId: string): AnalyserNode | null;
  readLfoPhase(moduleId: string, elapsed: number): number | undefined;
  readControlValue(moduleId: string): number | undefined;
  stop(): Promise<void>;
  dispose(): void;
}
