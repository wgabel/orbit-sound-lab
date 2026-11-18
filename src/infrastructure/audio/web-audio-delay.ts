import type { DelaySettings } from '../../domain/delay';
import { validateDelaySettings } from '../../domain/delay';

/** Master echo with a bounded feedback loop. Feedback is internal to the effect. */
export class WebAudioDelay {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private disposed = false;

  constructor(private readonly context: AudioContext, settings: DelaySettings) {
    validateDelaySettings(settings);
    this.input = context.createGain();
    this.output = context.createGain();
    this.delay = context.createDelay(2);
    this.feedback = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.output);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.update(settings);
  }

  update(settings: DelaySettings): void {
    if (this.disposed) throw new Error('Delay has been disposed.');
    validateDelaySettings(settings);
    const now = this.context.currentTime;
    this.delay.delayTime.setTargetAtTime(settings.timeSeconds, now, 0.025);
    this.feedback.gain.setTargetAtTime(settings.feedback, now, 0.025);
    this.dry.gain.setTargetAtTime(settings.enabled ? 1 - settings.mix : 1, now, 0.025);
    this.wet.gain.setTargetAtTime(settings.enabled ? settings.mix : 0, now, 0.025);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.disconnect();
    this.delay.disconnect();
    this.feedback.disconnect();
    this.dry.disconnect();
    this.wet.disconnect();
    this.output.disconnect();
  }
}
