import type { ModulationSource, ModulationSourceFactory } from '../../application/modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../../domain/modulation';
import { validateLowFrequencyOscillatorSettings } from '../../domain/modulation';
export class WebAudioLowFrequencyOscillator implements ModulationSource {
  readonly output: GainNode;
  private readonly oscillator: OscillatorNode;
  private started = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, settings: LowFrequencyOscillatorSettings) {
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator = context.createOscillator();
    this.output = context.createGain();
    this.oscillator.connect(this.output);
    this.update(settings);
  }
  start(): void { if (this.disposed) throw new Error('LFO disposed.'); if (!this.started) { this.oscillator.start(); this.started = true; } }
  update(settings: LowFrequencyOscillatorSettings): void {
    if (this.disposed) throw new Error('LFO disposed.');
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator.type = settings.waveform;
    this.oscillator.frequency.setTargetAtTime(settings.frequencyHz, this.context.currentTime, 0.015);
    this.output.gain.setTargetAtTime(settings.enabled ? settings.depthCents : 0, this.context.currentTime, 0.015);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) this.oscillator.stop();
    this.oscillator.disconnect(); this.output.disconnect();
  }
}
export class WebAudioLowFrequencyOscillatorFactory implements ModulationSourceFactory {
  constructor(private readonly context: AudioContext) {}
  create(settings: LowFrequencyOscillatorSettings): ModulationSource { return new WebAudioLowFrequencyOscillator(this.context, settings); }
}
