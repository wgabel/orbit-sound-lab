export const OSCILLATOR_WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square', 'sineTriangle', 'variablePulse', 'foldedSine', 'peakedSine', 'cycleEnvelope'] as const;
export type OscillatorWaveform = typeof OSCILLATOR_WAVEFORMS[number];
export const DEFAULT_OSCILLATOR_SHAPE = 0.5;
