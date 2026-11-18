import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings, validateAmplitudeEnvelopeSettings, validateDroneSettings } from './drone';

describe('per-oscillator amplitude envelope', () => {
  it('defaults to bypass so existing drones remain audible', () => {
    const drone = createDefaultDroneSettings();
    expect(drone.oscillators).toHaveLength(5);
    expect(drone.oscillators.every(oscillator => !oscillator.envelope.enabled)).toBe(true);
    validateDroneSettings(drone);
  });
  it('validates attack, decay, sustain and release bounds', () => {
    const envelope = createDefaultDroneSettings().oscillators[0].envelope;
    expect(() => validateAmplitudeEnvelopeSettings({...envelope, attackSeconds: -1})).toThrow();
    expect(() => validateAmplitudeEnvelopeSettings({...envelope, decaySeconds: Number.NaN})).toThrow();
    expect(() => validateAmplitudeEnvelopeSettings({...envelope, sustainLevel: 1.1})).toThrow();
    expect(() => validateAmplitudeEnvelopeSettings({...envelope, releaseSeconds: 31})).toThrow();
    expect(() => validateAmplitudeEnvelopeSettings({...envelope, sustainLevel: 0})).not.toThrow();
  });
});
