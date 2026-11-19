import { describe, expect, it } from 'vitest';
import { DEFAULT_CYCLE_ENVELOPE } from '../../domain/cycle-envelope';
import { readCycleEnvelopeHarmonics } from './cycle-envelope-wave';
import { analyseFoldedSineHarmonics, readOscillatorLoudnessGain } from './oscillator-loudness';

const SAMPLE_RATE = 48_000;

describe('oscillator loudness matching', () => {
  it('keeps a plain sine at unity and attenuates brighter waves more in the bass', () => {
    expect(readOscillatorLoudnessGain('sine',110,0.5,SAMPLE_RATE)).toBe(1);
    for (const waveform of ['square','sawtooth'] as const) {
      const bassGain = readOscillatorLoudnessGain(waveform,110,0.5,SAMPLE_RATE);
      expect(bassGain).toBeLessThan(0.65);
      expect(bassGain).toBeLessThan(readOscillatorLoudnessGain(waveform,880,0.5,SAMPLE_RATE));
    }
  });

  it('matches a sine when each shape control is at its pure sine setting', () => {
    expect(readOscillatorLoudnessGain('sineTriangle',110,0,SAMPLE_RATE)).toBe(1);
    expect(readOscillatorLoudnessGain('peakedSine',110,0,SAMPLE_RATE)).toBe(1);
    expect(readOscillatorLoudnessGain('foldedSine',110,0,SAMPLE_RATE,analyseFoldedSineHarmonics(0))).toBeCloseTo(1);
    const cycle = readCycleEnvelopeHarmonics(DEFAULT_CYCLE_ENVELOPE);
    expect(readOscillatorLoudnessGain('cycleEnvelope',110,0,SAMPLE_RATE,cycle)).toBe(1);
    expect(readOscillatorLoudnessGain('cycleEnvelope',110,1,SAMPLE_RATE,cycle)).not.toBeCloseTo(1);
  });

  it('accounts for pulse width and bounds extreme corrections', () => {
    expect(readOscillatorLoudnessGain('variablePulse',220,0.05,SAMPLE_RATE))
      .not.toBeCloseTo(readOscillatorLoudnessGain('variablePulse',220,0.5,SAMPLE_RATE));
    expect(readOscillatorLoudnessGain('square',20,0.5,SAMPLE_RATE)).toBeCloseTo(10 ** (-18 / 20));
    expect(readOscillatorLoudnessGain('sawtooth',16_000,0.5,SAMPLE_RATE)).toBeCloseTo(10 ** (3 / 20));
  });
});
