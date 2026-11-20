import { getStepGlideValues, prepareStepGlide } from '@domain/oscillator-step-sequence';
import type { OscillatorStep, StepValue } from '@domain/oscillator-step-sequence';
import type { DroneSettings } from '@domain/drone';

export type StepPlaybackMode = 'once' | 'loop' | 'manual';

export interface StepPlayhead {
  readonly index: number;
  readonly phase: 'glide' | 'hold' | 'waiting';
}

interface StepPlaybackCallbacks {
  readonly readDrone: () => DroneSettings;
  readonly applyValues: (values: readonly StepValue[]) => void;
  readonly onPlayhead: (playhead: StepPlayhead | null) => void;
}

export class OscillatorStepPlayer {
  private position = 0;
  private step?: {
    readonly startTime: number;
    readonly glide: ReturnType<typeof prepareStepGlide>;
    reachedTarget: boolean;
  };

  constructor(
    readonly mode: StepPlaybackMode,
    private readonly sequence: readonly {index: number; step: OscillatorStep}[],
    private readonly callbacks: StepPlaybackCallbacks
  ) {}

  get canAdvance(): boolean {
    return this.mode === 'loop' || this.position + 1 < this.sequence.length;
  }

  start(now: number): boolean {
    this.beginStep(now);
    return this.tick(now);
  }

  advance(now: number): boolean {
    if (!this.canAdvance) {
      this.callbacks.onPlayhead(null);
      return false;
    }
    this.position = (this.position + 1) % this.sequence.length;
    this.beginStep(now);
    return true;
  }

  tick(now: number): boolean {
    const current = this.step;
    if (!current) return false;
    const {step, index} = this.sequence[this.position];
    const elapsed = now - current.startTime;
    if (!current.reachedTarget) {
      this.callbacks.applyValues(getStepGlideValues(current.glide, elapsed, step.glideSeconds));
      if (elapsed < step.glideSeconds) return true;
      current.reachedTarget = true;
      this.callbacks.onPlayhead({index, phase: this.mode === 'manual' ? 'waiting' : 'hold'});
    }
    if (this.mode === 'manual' || elapsed < step.glideSeconds + step.holdSeconds) return true;
    return this.advance(now);
  }

  private beginStep(now: number): void {
    const {step, index} = this.sequence[this.position];
    this.step = {startTime: now, glide: prepareStepGlide(this.callbacks.readDrone(), step), reachedTarget: false};
    this.callbacks.onPlayhead({index, phase: 'glide'});
  }
}
