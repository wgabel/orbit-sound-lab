export interface CycleEnvelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

export const MINIMUM_CYCLE_STAGE = 0.01;
export const DEFAULT_CYCLE_ENVELOPE: CycleEnvelope = {attack:0.1,decay:0.15,sustain:0.5,release:0.25};
export const CYCLE_ENVELOPE_SAMPLE_COUNT = 512;

export function validateCycleEnvelope(envelope: CycleEnvelope): void {
  if (!envelope || ![envelope.attack,envelope.decay,envelope.release].every(
    duration => Number.isFinite(duration) && duration >= MINIMUM_CYCLE_STAGE && duration <= 1
  ) || envelope.attack + envelope.decay + envelope.release > 1 + 1e-12 ||
      !Number.isFinite(envelope.sustain) || envelope.sustain < 0 || envelope.sustain > 1) {
    throw new Error('Cycle Envelope stages must fit within one cycle and sustain level must be between 0% and 100%.');
  }
}

export function readCycleEnvelopeGain(envelope: CycleEnvelope, phase: number): number {
  const {attack,decay,sustain,release} = envelope;
  if (phase <= attack) return phase / attack;
  if (phase <= attack + decay) return 1 - (1 - sustain) * (phase - attack) / decay;
  return sustain * Math.min(1,(1 - phase) / release);
}

export function readEnvelopedSine(envelope: CycleEnvelope, phase: number): number {
  return Math.sin(2 * Math.PI * phase) * readCycleEnvelopeGain(envelope,phase);
}

export function sampleCycleEnvelope(envelope: CycleEnvelope): {samples: Float64Array; mean: number} {
  const samples = Float64Array.from({length:CYCLE_ENVELOPE_SAMPLE_COUNT},(_,index) =>
    readEnvelopedSine(envelope,index / CYCLE_ENVELOPE_SAMPLE_COUNT));
  return {samples,mean:samples.reduce((sum,sample) => sum + sample,0) / samples.length};
}
