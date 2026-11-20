import { expect, it } from 'vitest';
import { connectPatchPorts, createPatchModule, validatePatch } from '@domain/patch';
import type { Patch } from '@domain/patch';
import { DEFAULT_SIMPLEX_NOISE, readSimplexNoise } from './simplex-noise';

it('replays a smooth, bounded pattern with seed and rate controlling its shape and speed', () => {
  const settings = {...DEFAULT_SIMPLEX_NOISE,rate:1};
  const sample = (index: number) => readSimplexNoise(settings,index / 97);
  const samples = Array.from({length:4096},(_,index) => sample(index));
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.8);
  expect(readSimplexNoise(settings,10)).toBe(0.5);
  expect(readSimplexNoise({...settings,seed:31},89 / 97)).not.toBe(sample(89));
  expect(readSimplexNoise({...settings,rate:2},89 / 194)).toBe(sample(89));
  const boundary = readSimplexNoise(settings,10);
  const before = readSimplexNoise(settings,10 - 1e-5);
  const after = readSimplexNoise(settings,10 + 1e-5);
  expect(after - boundary).toBeCloseTo(boundary - before,8);
});

it('accepts only valid settings and exposes a control output with the normal cable range', () => {
  const noise = createPatchModule('simplexNoise','noise');
  const gain = createPatchModule('gain','gain');
  const patch: Patch = {version:1,modules:[noise,gain],cables:[]};
  const connected = connectPatchPorts(patch,'value',{moduleId:'noise',portId:'control'},{moduleId:'gain',portId:'level'});
  expect(connected.cables[0].mapping).toEqual({from:0,to:1});
  expect(() => validatePatch(JSON.parse(JSON.stringify(connected)))).not.toThrow();
  expect(() => validatePatch({...patch,modules:[{...noise,kind:'simplexNoise',settings:{rate:0,seed:1}}]})).toThrow(/rate/);
  expect(() => validatePatch({...patch,modules:[{...noise,kind:'simplexNoise',settings:{rate:1,seed:0.5}}]})).toThrow(/seed/);
});
