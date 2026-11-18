import type { DroneVoice } from '../../application/audio-contracts';
import type { DroneMixSettings, DroneSettings, OscillatorSettings } from '../../domain/drone';
import { validateDroneSettings, validateLowPassFilterSettings } from '../../domain/drone';
import { WebAudioWaveformSource } from './web-audio-waveform-source';
import { WebAudioDroneMix } from './web-audio-drone-mix';
import { PLAYBACK_FADE_SECONDS, fadeGain } from './web-audio-fade';

/** Spread resonance across two stages to avoid squaring the full UI Q peak. */
export function mapResonanceToStageQ(resonance: number): number {
  return Math.sqrt(resonance);
}

// Restore the previous unity-gain mono upmix at the panner's center.
const MONO_PAN_GAIN_COMPENSATION = Math.SQRT2;

interface OscillatorNodes {
  readonly source: WebAudioWaveformSource;
  readonly filter: BiquadFilterNode;
  readonly secondFilter: BiquadFilterNode;
  readonly dryGain: GainNode;
  readonly wetGain: GainNode;
  readonly gain: GainNode;
  readonly fadeGain: GainNode;
  readonly panner: StereoPannerNode;
  readonly amplitudeGain: GainNode;
  readonly waveformAnalyser: AnalyserNode;
  enabled: boolean;
}
/** Panned oscillator paths and centered noise feed the layer mix, then the drone level. */
export class WebAudioDrone implements DroneVoice {
  readonly output: GainNode;
  private readonly pitchBend: ConstantSourceNode;
  private readonly mix: WebAudioDroneMix;
  private mixSettings: DroneMixSettings;
  private readonly oscillators = new Map<string, OscillatorNodes>();
  private started = false;
  private stopped = false;
  private disposed = false;
  private stopPromise: Promise<void> | null = null;
  private finishStop: (() => void) | null = null;
  constructor(private readonly context: AudioContext, settings: DroneSettings) {
    validateDroneSettings(settings);
    this.pitchBend = context.createConstantSource();
    this.pitchBend.offset.value = 0;
    this.output = context.createGain();
    this.output.gain.value = settings.gain * MONO_PAN_GAIN_COMPENSATION;
    this.mixSettings = settings.mix;
    this.mix = new WebAudioDroneMix(context, settings.mix, this.output);
    for (const oscillatorSettings of settings.oscillators) {
      const source = new WebAudioWaveformSource(context, oscillatorSettings);
      this.pitchBend.connect(source.detune);
      const filter = context.createBiquadFilter();
      const secondFilter = context.createBiquadFilter();
      const dryGain = context.createGain();
      const wetGain = context.createGain();
      const gain = context.createGain();
      const fadeGain = context.createGain();
      const panner = context.createStereoPanner();
      panner.pan.value = oscillatorSettings.pan;
      const amplitudeGain = context.createGain();
      const waveformAnalyser = context.createAnalyser();
      waveformAnalyser.fftSize = 2048;
      waveformAnalyser.smoothingTimeConstant = 0;
      filter.type = 'lowpass';
      secondFilter.type = 'lowpass';
      filter.frequency.value = oscillatorSettings.filter.cutoffHz;
      filter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      secondFilter.frequency.value = oscillatorSettings.filter.cutoffHz;
      secondFilter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      dryGain.gain.value = oscillatorSettings.filter.enabled ? 0 : 1;
      wetGain.gain.value = oscillatorSettings.filter.enabled ? 1 : 0;
      gain.gain.value = (2 / settings.oscillators.length) * oscillatorSettings.volume;
      fadeGain.gain.value = 0;
      amplitudeGain.gain.value = 0.5;
      source.output.connect(dryGain);
      source.output.connect(filter);
      filter.connect(secondFilter);
      secondFilter.connect(wetGain);
      dryGain.connect(gain);
      wetGain.connect(gain);
      gain.connect(amplitudeGain);
      amplitudeGain.connect(fadeGain);
      fadeGain.connect(panner);
      panner.connect(this.mix.input);
      // Passive analysis branch: reads the audible voice after filters, LFO and fades.
      fadeGain.connect(waveformAnalyser);
      this.oscillators.set(oscillatorSettings.id, {source, filter, secondFilter, dryGain, wetGain, gain, fadeGain, panner, amplitudeGain, waveformAnalyser, enabled: oscillatorSettings.enabled});
    }
  }
  start(): void {
    if (this.disposed || this.stopped) throw new Error('Cannot restart a stopped drone.');
    if (this.started) return;
    this.started = true;
    this.pitchBend.start();
    const now = this.context.currentTime;
    for (const oscillator of this.oscillators.values()) {
      oscillator.source.start(now);
      if (oscillator.enabled) fadeGain(oscillator.fadeGain.gain, 1, now);
    }
    this.mix.update(this.mixSettings, now);
  }
  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (!this.started || this.stopped || this.disposed) return Promise.resolve();
    this.stopped = true;
    const now = this.context.currentTime;
    if (this.context.state !== 'running') {
      this.mix.stop(now, now);
      for (const {source} of this.oscillators.values()) source.stop(now);
      return Promise.resolve();
    }
    const firstSource = this.oscillators.values().next().value?.source.activeOscillator;
    if (!firstSource) return Promise.resolve();
    const end = now + PLAYBACK_FADE_SECONDS;
    this.stopPromise = new Promise(resolve => {
      const finish = () => {
        firstSource.removeEventListener('ended', finish);
        this.context.removeEventListener('statechange', handleStateChange);
        this.finishStop = null;
        resolve();
      };
      const handleStateChange = () => {
        if (this.context.state !== 'running') finish();
      };
      this.finishStop = finish;
      this.context.addEventListener('statechange', handleStateChange);
      firstSource.addEventListener('ended', finish);
      this.mix.stop(now, end);
      for (const oscillator of this.oscillators.values()) {
        fadeGain(oscillator.fadeGain.gain, 0, now);
        oscillator.source.stop(end);
      }
    });
    return this.stopPromise;
  }
  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Gain must be between 0 and 1.');
    this.output.gain.setTargetAtTime(value * MONO_PAN_GAIN_COMPENSATION, this.context.currentTime, 0.015);
  }
  updateOscillator(settings: OscillatorSettings): void {
    if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < 20 || settings.frequencyHz > 20000 || !Number.isFinite(settings.detuneCents) || Math.abs(settings.detuneCents) > 2400) throw new Error('Invalid oscillator settings.');
    validateLowPassFilterSettings(settings.filter);
    const oscillator = this.oscillators.get(settings.id);
    if (!oscillator) throw new Error('Unknown oscillator.');
    const now = this.context.currentTime;
    oscillator.source.update(settings.waveform, settings.frequencyHz, now);
    oscillator.source.detune.setTargetAtTime(settings.detuneCents, now, 0.015);
    oscillator.panner.pan.setTargetAtTime(settings.pan, now, 0.015);
    oscillator.gain.gain.setTargetAtTime((2 / this.oscillators.size) * settings.volume, now, 0.015);
    if (oscillator.enabled !== settings.enabled) {
      oscillator.enabled = settings.enabled;
      if (this.started && !this.stopped) fadeGain(oscillator.fadeGain.gain, settings.enabled ? 1 : 0, now);
    }
    oscillator.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.filter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    oscillator.secondFilter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.secondFilter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    // Short crossfade avoids discontinuities when switching filter bypass.
    oscillator.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    oscillator.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
  }
  setMix(settings: DroneMixSettings): void {
    this.mixSettings = settings;
    if (this.started && !this.stopped) this.mix.update(settings, this.context.currentTime);
  }
  getWaveformAnalyser(oscillatorId: string): AnalyserNode | null {
    return this.oscillators.get(oscillatorId)?.waveformAnalyser ?? null;
  }
  getAmplitudeParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.amplitudeGain.gain;
  }
  getDetuneParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.source.detune;
  }
  getFilterCutoffParameters(oscillatorId: string): readonly AudioParam[] {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return [oscillator.filter.frequency, oscillator.secondFilter.frequency];
  }
  setPitchBend(cents: number): void {
    if (this.started) this.pitchBend.offset.setTargetAtTime(cents, this.context.currentTime, 0.008);
    else this.pitchBend.offset.value = cents;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.finishStop?.();
    if (this.started) this.pitchBend.stop();
    this.pitchBend.disconnect();
    for (const {source, filter, secondFilter, dryGain, wetGain, gain, fadeGain, panner, amplitudeGain, waveformAnalyser} of this.oscillators.values()) {
      source.dispose(); filter.disconnect(); secondFilter.disconnect(); dryGain.disconnect(); wetGain.disconnect(); gain.disconnect(); fadeGain.disconnect(); amplitudeGain.disconnect(); panner.disconnect(); waveformAnalyser.disconnect();
    }
    this.oscillators.clear();
    this.mix.dispose();
    this.output.disconnect();
  }
}
