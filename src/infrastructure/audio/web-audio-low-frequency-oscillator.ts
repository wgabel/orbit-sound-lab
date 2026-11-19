import type { ModulationSource, ModulationSourceFactory } from '../../application/modulation-contracts';
import type { LowFrequencyOscillatorSettings, LowFrequencyOscillatorWaveform } from '../../domain/modulation';
import { DEFAULT_SHAPE_LFO_DEPTH, validateLowFrequencyOscillatorSettings } from '../../domain/modulation';
import type { LfoWorkletConfiguration, WebAudioLfoWorkletFactory } from './web-audio-lfo-worklet';

const NATIVE_LFO_WAVEFORMS = ['sine','triangle','square','sawtooth'] as const;

function isNativeLfoWaveform(waveform: LowFrequencyOscillatorWaveform): waveform is typeof NATIVE_LFO_WAVEFORMS[number] {
  return NATIVE_LFO_WAVEFORMS.some(native => native === waveform);
}

export class WebAudioLowFrequencyOscillator implements ModulationSource {
  readonly output: GainNode;
  private readonly oscillator: OscillatorNode;
  private readonly periodicGain: GainNode;
  private readonly workletGain: GainNode;
  private readonly limiter: WaveShaperNode;
  private readonly smoother: BiquadFilterNode;
  private workletOscillator?: AudioWorkletNode;
  private started = false;
  private disposed = false;

  constructor(
    private readonly context: AudioContext, settings: LowFrequencyOscillatorSettings,
    private readonly lfoWorklet?: WebAudioLfoWorkletFactory
  ) {
    validateLowFrequencyOscillatorSettings(settings);
    this.oscillator = context.createOscillator();
    this.periodicGain = context.createGain();
    this.workletGain = context.createGain();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.periodicGain.gain.value = settings.sync || !isNativeLfoWaveform(settings.waveform) ? 0 : 1;
    this.workletGain.gain.value = 1 - this.periodicGain.gain.value;
    this.limiter = context.createWaveShaper();
    // Band-limited square and saw waves can overshoot their nominal ±1.
    this.limiter.curve = new Float32Array([-1, 0, 1]);
    this.smoother = context.createBiquadFilter();
    this.smoother.type = 'lowpass';
    this.smoother.frequency.value = 80;
    this.smoother.Q.value = 20 * Math.log10(0.5);
    this.oscillator.connect(this.periodicGain).connect(this.limiter);
    this.workletGain.connect(this.limiter);
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
    const synchronized = settings.sync ?? false;
    const useWorklet = synchronized || !isNativeLfoWaveform(settings.waveform);
    if (useWorklet) {
      const configuration: LfoWorkletConfiguration = {
        waveform: settings.waveform,
        synchronized,
        frequencyHz: settings.frequencyHz,
        phaseDegrees: synchronized ? (settings.phaseDegrees ?? 0) % 360 : 0
      };
      if (!this.workletOscillator) {
        if (!this.lfoWorklet) throw new Error('This LFO waveform or sync mode requires AudioWorklet.');
        this.workletOscillator = this.lfoWorklet.create(configuration);
        this.workletOscillator.connect(this.workletGain);
      } else {
        this.workletOscillator.port.postMessage(configuration);
      }
      this.workletOscillator.parameters.get('rate')?.setTargetAtTime(settings.frequencyHz, now, 0.015);
    }
    if (isNativeLfoWaveform(settings.waveform)) {
      this.oscillator.type = settings.waveform;
      this.oscillator.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    }
    this.periodicGain.gain.setTargetAtTime(useWorklet ? 0 : 1, now, 0.02);
    this.workletGain.gain.setTargetAtTime(useWorklet ? 1 : 0, now, 0.02);
    const depth = settings.destination === 'pitch' ? settings.depthCents :
      settings.destination === 'amplitude' ? settings.depthAmplitude :
      settings.destination === 'shape' ? settings.depthShape ?? DEFAULT_SHAPE_LFO_DEPTH : settings.depthHz;
    this.output.gain.setTargetAtTime(settings.enabled ? depth : 0, now, 0.02);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) this.oscillator.stop();
    if (this.workletOscillator) {
      this.workletOscillator.port.postMessage('stop');
      this.workletOscillator.port.close();
      this.workletOscillator.disconnect();
    }
    this.oscillator.disconnect();
    this.periodicGain.disconnect();
    this.workletGain.disconnect();
    this.limiter.disconnect();
    this.smoother.disconnect();
    this.output.disconnect();
  }
}

export class WebAudioLowFrequencyOscillatorFactory implements ModulationSourceFactory {
  constructor(private readonly context: AudioContext, private readonly lfoWorklet: WebAudioLfoWorkletFactory) {}
  create(settings: LowFrequencyOscillatorSettings): ModulationSource {
    return new WebAudioLowFrequencyOscillator(this.context, settings, this.lfoWorklet);
  }
}
