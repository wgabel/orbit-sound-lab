import { expect, it } from 'vitest';
import { DEFAULT_CYCLE_ENVELOPE, readCycleEnvelopeGain, sampleCycleEnvelope, validateCycleEnvelope } from './cycle-envelope';
import { createPatchModule, getPatchPort, validatePatch } from './patch';
import type { Patch } from './patch';

it('fits attack, decay, sustain and release within a single cycle', () => {
  const envelope = DEFAULT_CYCLE_ENVELOPE;
  expect([0,0.05,0.1,0.25,0.5,0.75,0.875,1].map(phase => readCycleEnvelopeGain(envelope,phase)))
    .toEqual([0,0.5,1,0.5,0.5,0.5,0.25,0]);
  expect(readCycleEnvelopeGain(envelope,0.175)).toBeCloseTo(0.75);
  expect(() => validateCycleEnvelope({...envelope,attack:0.75})).toThrow(/fit within one cycle/);
  expect(() => validateCycleEnvelope({...envelope,release:0})).toThrow(/fit within one cycle/);
  expect(() => validateCycleEnvelope({...envelope,sustain:1.01})).toThrow(/sustain level/);
});

it('calculates an offset for an asymmetric cycle so the playback waveform can be centered', () => {
  const {samples,mean} = sampleCycleEnvelope(DEFAULT_CYCLE_ENVELOPE);
  expect(Math.abs(mean)).toBeGreaterThan(0.01);
  expect(samples.reduce((sum,sample) => sum + sample - mean,0) / samples.length).toBeCloseTo(0,12);
});

it('accepts the cycle settings in saved patches and keeps a normalized Amount input', () => {
  const wave = createPatchModule('wave','wave');
  if (wave.kind !== 'wave') throw new Error('Expected a Wave module.');
  const settings = {...wave.settings,waveform:'cycleEnvelope' as const,cycleEnvelope:DEFAULT_CYCLE_ENVELOPE};
  const patch: Patch = {version:1,modules:[{...wave,settings}],cables:[]};
  expect(() => validatePatch(JSON.parse(JSON.stringify(patch)))).not.toThrow();
  expect(getPatchPort(patch,{moduleId:'wave',portId:'shape'})).toMatchObject({
    label:'Amount',parameter:{minimum:0,maximum:1,displayScale:100}
  });
  expect(() => validatePatch({...patch,modules:[{...wave,settings:{...settings,
    cycleEnvelope:{...settings.cycleEnvelope,decay:0.95}}}]})).toThrow(/Cycle Envelope/);
});
