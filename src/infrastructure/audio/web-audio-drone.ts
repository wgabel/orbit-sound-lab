import type { DroneVoice } from '../../application/audio-contracts';
import type { DroneSettings, OscillatorSettings } from '../../domain/drone';
import { validateDroneSettings } from '../../domain/drone';

/** Owns the five oscillators and the voice output gain. No React dependency. */
export class WebAudioDrone implements DroneVoice {
  readonly output: GainNode;
  private readonly oscillators = new Map<string, { source: OscillatorNode; gain: GainNode }>();
  private started = false;
  private stopped = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, settings: DroneSettings) {
    validateDroneSettings(settings);
    this.output = context.createGain();
    this.output.gain.value = settings.gain;
    for (const oscillatorSettings of settings.oscillators) {
      const source = context.createOscillator();
      const gain = context.createGain();
      source.type = oscillatorSettings.waveform;
      source.frequency.value = oscillatorSettings.frequencyHz;
      source.detune.value = oscillatorSettings.detuneCents;
      gain.gain.value = oscillatorSettings.enabled ? 1 / settings.oscillators.length : 0;
      source.connect(gain);
      gain.connect(this.output);
      this.oscillators.set(oscillatorSettings.id, {source, gain});
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
    const oscillator = this.oscillators.get(settings.id);
    if (!oscillator) throw new Error('Unknown oscillator.');
    oscillator.source.type = settings.waveform;
    oscillator.source.frequency.setTargetAtTime(settings.frequencyHz, this.context.currentTime, 0.015);
    oscillator.source.detune.setTargetAtTime(settings.detuneCents, this.context.currentTime, 0.015);
    oscillator.gain.gain.setTargetAtTime(settings.enabled ? 1 / this.oscillators.size : 0, this.context.currentTime, 0.015);
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const {source, gain} of this.oscillators.values()) { source.disconnect(); gain.disconnect(); }
    this.oscillators.clear();
    this.output.disconnect();
  }
}
