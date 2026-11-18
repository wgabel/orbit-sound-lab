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
  readonly envelopeGain: GainNode;
  envelopeSettings: OscillatorSettings['envelope'];
  gateHeld: boolean;
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
      const envelopeGain = context.createGain();
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
      gain.gain.value = oscillatorSettings.enabled ? 1 / settings.oscillators.length : 0;
      envelopeGain.gain.value = oscillatorSettings.envelope.enabled ? 0 : 1;
      source.connect(dryGain);
      source.connect(filter);
      filter.connect(secondFilter);
      secondFilter.connect(wetGain);
      dryGain.connect(gain);
      wetGain.connect(gain);
      gain.connect(envelopeGain);
      envelopeGain.connect(this.output);
      this.oscillators.set(oscillatorSettings.id, {source, filter, secondFilter, dryGain, wetGain, gain, envelopeGain, envelopeSettings: oscillatorSettings.envelope, gateHeld: false});
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
    const wasEnvelopeEnabled = oscillator.envelopeSettings.enabled;
    oscillator.envelopeSettings = settings.envelope;
    if (wasEnvelopeEnabled !== settings.envelope.enabled) {
      oscillator.gateHeld = false;
      this.holdEnvelopeValue(oscillator.envelopeGain.gain);
      oscillator.envelopeGain.gain.setTargetAtTime(settings.envelope.enabled ? 0 : 1, this.context.currentTime, 0.015);
    }
    const now = this.context.currentTime;
    oscillator.source.frequency.setTargetAtTime(settings.frequencyHz, now, 0.015);
    oscillator.source.detune.setTargetAtTime(settings.detuneCents, now, 0.015);
    oscillator.gain.gain.setTargetAtTime(settings.enabled ? 1 / this.oscillators.size : 0, now, 0.015);
    oscillator.filter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.filter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    oscillator.secondFilter.frequency.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.secondFilter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    // Short crossfade avoids discontinuities when switching filter bypass.
    oscillator.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    oscillator.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
  }
  private holdEnvelopeValue(parameter: AudioParam): void {
    const now = this.context.currentTime;
    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(now);
    } else {
      // Older engines lack cancelAndHoldAtTime; parameter.value is only an approximation
      // of the currently rendered envelope during an active ramp.
      const currentValue = parameter.value;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(currentValue, now);
    }
  }
  gateOn(oscillatorId: string): void {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    if (!oscillator.envelopeSettings.enabled || oscillator.gateHeld) return;
    oscillator.gateHeld = true;
    const envelope = oscillator.envelopeSettings;
    const gain = oscillator.envelopeGain.gain;
    const now = this.context.currentTime;
    this.holdEnvelopeValue(gain);
    gain.linearRampToValueAtTime(1, now + envelope.attackSeconds);
    gain.linearRampToValueAtTime(envelope.sustainLevel, now + envelope.attackSeconds + envelope.decaySeconds);
  }
  gateOff(oscillatorId: string): void {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    if (!oscillator.envelopeSettings.enabled || !oscillator.gateHeld) return;
    oscillator.gateHeld = false;
    const gain = oscillator.envelopeGain.gain;
    const now = this.context.currentTime;
    this.holdEnvelopeValue(gain);
    gain.linearRampToValueAtTime(0, now + oscillator.envelopeSettings.releaseSeconds);
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
    for (const {source, filter, secondFilter, dryGain, wetGain, gain, envelopeGain} of this.oscillators.values()) {
      source.disconnect(); filter.disconnect(); secondFilter.disconnect(); dryGain.disconnect(); wetGain.disconnect(); gain.disconnect(); envelopeGain.disconnect();
    }
    this.oscillators.clear();
    this.output.disconnect();
  }
}
