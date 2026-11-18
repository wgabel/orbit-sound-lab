import { DEFAULT_DRONE_ENVELOPE, ENVELOPE_MIN_SECONDS, validateDroneEnvelope } from '../../domain/drone-envelope';
import type { DroneEnvelope } from '../../domain/drone-envelope';

interface EnvelopePoint { readonly time: number; readonly gain: number; }

export class WebAudioDroneGate {
  readonly node: GainNode;
  private envelope = DEFAULT_DRONE_ENVELOPE;
  private points: readonly EnvelopePoint[] = [{time: 0, gain: 1}];

  constructor(private readonly context: BaseAudioContext) {
    this.node = context.createGain();
  }

  setEnvelope(envelope: DroneEnvelope): void {
    validateDroneEnvelope(envelope);
    this.envelope = envelope;
  }

  setContinuous(continuous: boolean): void {
    this.schedule([{time: this.context.currentTime + ENVELOPE_MIN_SECONDS, gain: continuous ? 1 : 0}]);
  }

  trigger(): void {
    const peak = this.context.currentTime + this.envelope.attack;
    this.schedule([{time: peak, gain: 1}, {time: peak + this.envelope.decay, gain: this.envelope.sustain}]);
  }

  release(): void {
    this.schedule([{time: this.context.currentTime + this.envelope.release, gain: 0}]);
  }

  reset(continuous: boolean): void {
    const time = this.context.currentTime;
    const gain = continuous ? 1 : 0;
    this.node.gain.cancelScheduledValues(time);
    this.node.gain.setValueAtTime(gain, time);
    this.points = [{time, gain}];
  }

  private gainAt(time: number): number {
    let previous = this.points[0];
    for (const next of this.points.slice(1)) {
      if (time < next.time) {
        const fraction = (time - previous.time) / (next.time - previous.time);
        return previous.gain + (next.gain - previous.gain) * fraction;
      }
      previous = next;
    }
    return previous.gain;
  }

  private schedule(points: readonly EnvelopePoint[]): void {
    const now = this.context.currentTime;
    const gain = this.gainAt(now);
    this.node.gain.cancelScheduledValues(now);
    this.node.gain.setValueAtTime(gain, now);
    for (const point of points) this.node.gain.linearRampToValueAtTime(point.gain, point.time);
    this.points = [{time: now, gain}, ...points];
  }
}
