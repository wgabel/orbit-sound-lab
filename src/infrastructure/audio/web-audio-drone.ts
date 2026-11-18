import type { DroneVoice } from '../../application/audio-contracts';
import type { DroneSettings, OscillatorSettings } from '../../domain/drone';
import { validateDroneSettings, validateLowPassFilterSettings } from '../../domain/drone';

interface OscillatorNodes {
  readonly source: OscillatorNode;
  readonly filter: BiquadFilterNode;
  readonly dryGain: GainNode;
  readonly wetGain: GainNode;
  readonly gain: GainNode;
}
/** Native Web Audio signal path: oscillator → dry/filter paths → voice gain → master. */
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
      const dryGain = context.createGain();
      const wetGain = context.createGain();
      const gain = context.createGain();
      source.type = oscillatorSettings.waveform;
      source.frequency.value = oscillatorSettings.frequencyHz;
      source.detune.value = oscillatorSettings.detuneCents;
      filter.type = 'lowpass';
      filter.frequency.value = oscillatorSettings.filter.cutoffHz;
      filter.Q.value = oscillatorSettings.filter.resonance;
      dryGain.gain.value = oscillatorSettings.filter.enabled ? 0 : 1;
      wetGain.gain.value = oscillatorSettings.filter.enabled ? 1 : 0;
      gain.gain.value = oscillatorSettings.enabled ? 1 / settings.oscillators.length : 0;
      source.connect(dryGain);
      source.connect(filter);
      filter.connect(wetGain);
      dryGain.connect(gain);
      wetGain.connect(gain);
      gain.connect(this.output);
      this.oscillators.set(oscillatorSettings.id, {source, filter, dryGain, wetGain, gain});
    }
  }
  start(): void {
    if (this.disposed || this.stopped) throw new Error('Cannot restart a stopped drone.');
    if (this.started) return;
    this.started = true;
    for (const {source} of this.oscillators.values()) source.start();
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
    oscillator.gain.gain.setTargetAtTime(settings.enabled ? 1 / this.oscillators.size : 0, now, 0.015);
    oscillator.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.filter.Q.setTargetAtTime(settings.filter.resonance, now, 0.02);
    // Short crossfade avoids discontinuities when switching filter bypass.
    oscillator.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    oscillator.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
  }
  getDetuneParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.source.detune;
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const {source, filter, dryGain, wetGain, gain} of this.oscillators.values()) {
      source.disconnect(); filter.disconnect(); dryGain.disconnect(); wetGain.disconnect(); gain.disconnect();
    }
    this.oscillators.clear();
    this.output.disconnect();
  }
}
