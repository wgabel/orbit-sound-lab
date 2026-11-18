import type { DroneVoice } from '../../application/audio-contracts';
import type { DroneSettings, OscillatorSettings } from '../../domain/drone';
import { validateDroneSettings, validateLowPassFilterSettings } from '../../domain/drone';

/** Spread resonance across two stages to avoid squaring the full UI Q peak. */
export function mapResonanceToStageQ(resonance: number): number {
  return Math.sqrt(resonance);
}

interface OscillatorNodes {
  readonly source: OscillatorNode;
  readonly filter: BiquadFilterNode;
  readonly secondFilter: BiquadFilterNode;
  readonly dryGain: GainNode;
  readonly wetGain: GainNode;
  readonly gain: GainNode;
  readonly fadeGain: GainNode;
  readonly amplitudeGain: GainNode;
  fadeSettings: OscillatorSettings['fade'];
  enabled: boolean;
}
/** Native Web Audio signal path: oscillator → dry/two cascaded low-pass filters → voice gain → master. Two biquads yield a four-pole (24 dB/octave asymptotic) response; this is not a nonlinear analog ladder. */
export class WebAudioDrone implements DroneVoice {
  readonly output: GainNode;
  private readonly oscillators = new Map<string, OscillatorNodes>();
  private started = false;
  private stopped = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, settings: DroneSettings) {
    validateDroneSettings(settings);
    this.output = context.createGain();
    this.output.gain.value = settings.gain;
    for (const oscillatorSettings of settings.oscillators) {
      const source = context.createOscillator();
      const filter = context.createBiquadFilter();
      const secondFilter = context.createBiquadFilter();
      const dryGain = context.createGain();
      const wetGain = context.createGain();
      const gain = context.createGain();
      const fadeGain = context.createGain();
      const amplitudeGain = context.createGain();
      source.type = oscillatorSettings.waveform;
      source.frequency.value = oscillatorSettings.frequencyHz;
      source.detune.value = oscillatorSettings.detuneCents;
      filter.type = 'lowpass';
      secondFilter.type = 'lowpass';
      filter.frequency.value = oscillatorSettings.filter.cutoffHz;
      filter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      secondFilter.frequency.value = oscillatorSettings.filter.cutoffHz;
      secondFilter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      dryGain.gain.value = oscillatorSettings.filter.enabled ? 0 : 1;
      wetGain.gain.value = oscillatorSettings.filter.enabled ? 1 : 0;
      gain.gain.value = 2 / settings.oscillators.length;
      fadeGain.gain.value = 0;
      amplitudeGain.gain.value = 0.5;
      source.connect(dryGain);
      source.connect(filter);
      filter.connect(secondFilter);
      secondFilter.connect(wetGain);
      dryGain.connect(gain);
      wetGain.connect(gain);
      gain.connect(amplitudeGain);
      amplitudeGain.connect(fadeGain);
      fadeGain.connect(this.output);
      this.oscillators.set(oscillatorSettings.id, {source, filter, secondFilter, dryGain, wetGain, gain, fadeGain, amplitudeGain, fadeSettings: oscillatorSettings.fade, enabled: oscillatorSettings.enabled});
    }
  }
  start(): void {
    if (this.disposed || this.stopped) throw new Error('Cannot restart a stopped drone.');
    if (this.started) return;
    this.started = true;
    for (const oscillator of this.oscillators.values()) {
      oscillator.source.start();
      if (oscillator.enabled) this.scheduleFade(oscillator, 1, oscillator.fadeSettings.fadeInSeconds);
    }
  }
  stop(): void {
    if (this.stopped || this.disposed) return;
    this.stopped = true;
    if (this.started) for (const {source} of this.oscillators.values()) source.stop();
  }
  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Gain must be between 0 and 1.');
    this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.015);
  }
  updateOscillator(settings: OscillatorSettings): void {
    if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < 20 || settings.frequencyHz > 20000 || !Number.isFinite(settings.detuneCents) || Math.abs(settings.detuneCents) > 2400) throw new Error('Invalid oscillator settings.');
    validateLowPassFilterSettings(settings.filter);
    const oscillator = this.oscillators.get(settings.id);
    if (!oscillator) throw new Error('Unknown oscillator.');
    oscillator.source.type = settings.waveform;
    const now = this.context.currentTime;
    oscillator.source.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    oscillator.source.detune.setTargetAtTime(settings.detuneCents, now, 0.015);
    oscillator.fadeSettings = settings.fade;
    if (oscillator.enabled !== settings.enabled) {
      oscillator.enabled = settings.enabled;
      if (this.started && !this.stopped) this.scheduleFade(oscillator, settings.enabled ? 1 : 0, settings.enabled ? settings.fade.fadeInSeconds : settings.fade.fadeOutSeconds);
    }
    oscillator.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.filter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    oscillator.secondFilter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.secondFilter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    // Short crossfade avoids discontinuities when switching filter bypass.
    oscillator.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    oscillator.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
  }
  private scheduleFade(oscillator: OscillatorNodes, target: number, duration: number): void {
    const parameter = oscillator.fadeGain.gain;
    const now = this.context.currentTime;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else {
      const currentValue = parameter.value;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(currentValue, now);
    }
    parameter.linearRampToValueAtTime(target, now + duration);
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
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const {source, filter, secondFilter, dryGain, wetGain, gain, fadeGain, amplitudeGain} of this.oscillators.values()) {
      source.disconnect(); filter.disconnect(); secondFilter.disconnect(); dryGain.disconnect(); wetGain.disconnect(); gain.disconnect(); fadeGain.disconnect(); amplitudeGain.disconnect();
    }
    this.oscillators.clear();
    this.output.disconnect();
  }
}
