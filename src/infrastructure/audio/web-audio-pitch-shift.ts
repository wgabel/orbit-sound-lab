/**
 * Real-time dual-grain delay-line pitch shifter.
 * Two overlapping, windowed delay ramps keep playback continuous.
 * This is a lightweight time-domain effect: transients and extreme intervals can sound granular.
 */
export class WebAudioPitchShift {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioBufferSourceNode[] = [];

  constructor(context: AudioContext, semitones: number, cents: number) {
    this.input = context.createGain();
    this.output = context.createGain();
    const ratio = 2 ** ((semitones + cents / 100) / 12);
    if (Math.abs(ratio - 1) < 0.00001) {
      this.input.connect(this.output);
      return;
    }

    const difference = Math.abs(1 - ratio);
    const period = Math.max(0.04, Math.min(0.18, 0.20 / difference));
    const depth = difference * period;
    const sampleRate = 8192;
    const frames = Math.round(period * sampleRate);
    const baseDelay = 0.012;
    const rampBuffer = context.createBuffer(1, frames, sampleRate);
    const windowBuffer = context.createBuffer(1, frames, sampleRate);
    const ramp = rampBuffer.getChannelData(0);
    const window = windowBuffer.getChannelData(0);
    for (let index = 0; index < frames; index++) {
      const phase = index / frames;
      ramp[index] = ratio > 1 ? 1 - phase : phase;
      window[index] = Math.sin(Math.PI * phase) ** 2;
    }

    for (const offset of [0, 0.5]) {
      const delay = context.createDelay(1);
      delay.delayTime.value = baseDelay;
      const modulation = context.createGain();
      modulation.gain.value = depth;
      const windowGain = context.createGain();
      windowGain.gain.value = 0;
      const rampSource = context.createBufferSource();
      rampSource.buffer = rampBuffer;
      rampSource.loop = true;
      const windowSource = context.createBufferSource();
      windowSource.buffer = windowBuffer;
      windowSource.loop = true;
      this.input.connect(delay);
      delay.connect(windowGain).connect(this.output);
      rampSource.connect(modulation).connect(delay.delayTime);
      windowSource.connect(windowGain.gain);
      const startTime = context.currentTime + 0.01;
      rampSource.start(startTime, offset * period);
      windowSource.start(startTime, offset * period);
      this.nodes.push(delay, modulation, windowGain);
      this.sources.push(rampSource, windowSource);
    }
  }

  dispose(): void {
    for (const source of this.sources) {
      try {source.stop();} catch { /* Source may already be stopped. */ }
      source.disconnect();
    }
    this.input.disconnect();
    this.output.disconnect();
    for (const node of this.nodes) node.disconnect();
  }
}
