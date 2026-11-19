import { sampleCycleEnvelope } from '../../domain/cycle-envelope';
import type { CycleEnvelope } from '../../domain/cycle-envelope';

const HARMONIC_COUNT = 64;

/** Read the coefficients for a band-limited cycle without a DC component. */
export function readCycleEnvelopeHarmonics(envelope: CycleEnvelope) {
  return analyseCycleHarmonics(sampleCycleEnvelope(envelope).samples);
}

export function analyseCycleHarmonics(samples: Float64Array) {
  const cosine = new Float32Array(HARMONIC_COUNT + 1);
  const sine = new Float32Array(HARMONIC_COUNT + 1);
  for (let harmonic = 1; harmonic <= HARMONIC_COUNT; harmonic++) {
    const angle = 2 * Math.PI * harmonic / samples.length;
    const cosineStep = Math.cos(angle);
    const sineStep = Math.sin(angle);
    let phaseCosine = 1;
    let phaseSine = 0;
    let real = 0;
    let imaginary = 0;
    for (const sample of samples) {
      real += sample * phaseCosine;
      imaginary += sample * phaseSine;
      const nextCosine = phaseCosine * cosineStep - phaseSine * sineStep;
      phaseSine = phaseSine * cosineStep + phaseCosine * sineStep;
      phaseCosine = nextCosine;
    }
    cosine[harmonic] = real * 2 / samples.length;
    sine[harmonic] = imaginary * 2 / samples.length;
  }
  return {cosine,sine};
}
