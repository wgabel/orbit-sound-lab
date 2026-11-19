import type { Patch } from '../domain/patch';

export interface PatchPlayback {
  start(patch: Patch): Promise<void>;
  update(patch: Patch): void;
  readElapsed(): number;
  readOutputLevel(): number;
  stop(): Promise<void>;
  dispose(): void;
}
