import type { ModulationSource, ModulationSourceFactory } from '../../application/modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../../domain/modulation';
import { validateLowFrequencyOscillatorSettings } from '../../domain/modulation';
import type { WebAudioSmoothRandomLfoFactory } from './web-audio-smooth-random-lfo';

export class WebAudioLowFrequencyOscillator implements ModulationSource {
  readonly output: GainNode;
  private readonly oscillator: OscillatorNode;
  private readonly periodicGain: GainNode;
  private readonly randomGain: GainNode;
  private readonly limiter: WaveShaperNode;
  private readonly smoother: BiquadFilterNode;
  private randomOscillator?: AudioWorkletNode;
  private started = false;
  private disposed = false;

  constructor(
    private readonly context: AudioContext, settings: LowFrequencyOscillatorSettings,
    private readonly smoothRandom?: WebAudioSmoothRandomLfoFactory
  ) {
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator = context.createOscillator();
    this.periodicGain = context.createGain();
    this.randomGain = context.createGain();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.periodicGain.gain.value = settings.waveform === 'smoothRandom' ? 0 : 1;
    this.randomGain.gain.value = 1 - this.periodicGain.gain.value;
    this.limiter = context.createWaveShaper();
    // Band-limited square and saw waves can overshoot their nominal ±1.
    this.limiter.curve = new Float32Array([-1, 0, 1]);
    this.smoother = context.createBiquadFilter();
    this.smoother.type = 'lowpass';
    this.smoother.frequency.value = 80;
    this.smoother.Q.value = 20 * Math.log10(0.5);
    this.oscillator.connect(this.periodicGain).connect(this.limiter);
    this.randomGain.connect(this.limiter);
    this.limiter.connect(this.smoother).connect(this.output);
    this.update(settings);
  }

  start(): void {
    if (this.disposed) throw new Error('LFO disposed.');
    if (!this.started) {
      this.oscillator.start();
      this.started = true;
    }
  }

  update(settings: LowFrequencyOscillatorSettings): void {
    if (this.disposed) throw new Error('LFO disposed.');
    validateLowFrequencyOscillatorSettings(settings);
    const now = this.context.currentTime;
    const useRandom = settings.waveform === 'smoothRandom';
    if (useRandom) {
      if (!this.randomOscillator) {
        if (!this.smoothRandom) throw new Error('Smooth Random LFO is unavailable.');
        this.randomOscillator = this.smoothRandom.create(settings.frequencyHz);
        this.randomOscillator.connect(this.randomGain);
      }
      this.randomOscillator.parameters.get('rate')?.setTargetAtTime(settings.frequencyHz, now, 0.015);
    } else {
      this.oscillator.type = settings.waveform;
      this.oscillator.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    }
    this.periodicGain.gain.setTargetAtTime(useRandom ? 0 : 1, now, 0.02);
    this.randomGain.gain.setTargetAtTime(useRandom ? 1 : 0, now, 0.02);
    const depth = settings.destination === 'pitch' ? settings.depthCents :
      settings.destination === 'amplitude' ? settings.depthAmplitude : settings.depthHz;
    this.output.gain.setTargetAtTime(settings.enabled ? depth : 0, now, 0.02);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) this.oscillator.stop();
    if (this.randomOscillator) {
      this.randomOscillator.port.postMessage('stop');
      this.randomOscillator.port.close();
      this.randomOscillator.disconnect();
    }
    this.oscillator.disconnect();
    this.periodicGain.disconnect();
    this.randomGain.disconnect();
    this.limiter.disconnect();
    this.smoother.disconnect();
    this.output.disconnect();
  }
}

export class WebAudioLowFrequencyOscillatorFactory implements ModulationSourceFactory {
  constructor(private readonly context: AudioContext, private readonly smoothRandom: WebAudioSmoothRandomLfoFactory) {}
  create(settings: LowFrequencyOscillatorSettings): ModulationSource {
    return new WebAudioLowFrequencyOscillator(this.context, settings, this.smoothRandom);
  }
}
