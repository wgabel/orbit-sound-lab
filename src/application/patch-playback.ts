import type { PatchLfoReading } from '../domain/patch-lfo';
import type { Patch } from '../domain/patch';

export interface PatchPlayback {
  readonly sampleRate: number;
  start(patch: Patch): Promise<void>;
  update(patch: Patch): void;
  readAudibleElapsed(): number;
  readOutputLevel(): number;
  readLfo(moduleId: string, elapsed: number): PatchLfoReading | undefined;
  stop(): Promise<void>;
  dispose(): void;
}
