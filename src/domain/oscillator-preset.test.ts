import { expect, it } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { retargetOscillatorSnapshot } from './oscillator-clipboard';
import { readOscillatorPreset } from './oscillator-preset';

function createPresetFixture() {
  const oscillator = {...createDefaultDroneSettings().oscillators[0],waveform:'peakedSine' as const,shape:0.62};
  const modulations = createDefaultLowFrequencyOscillators([oscillator.id]).map(modulation =>
    modulation.destination === 'shape' ? {...modulation,enabled:true,depthShape:0.17} : modulation);
  return {kind:'orbit-oscillator',schemaVersion:1,id:'reed',name:' Reed ',createdAt:'2026-11-19T00:00:00Z',
    snapshot:{oscillator,modulations}};
}

it('round-trips the oscillator and its LFOs and retargets them without changing the destination switch', () => {
  const fixture = createPresetFixture();
  const preset = readOscillatorPreset(JSON.parse(JSON.stringify(fixture)));
  expect(preset.name).toBe('Reed');
  expect(preset.snapshot).toEqual(fixture.snapshot);
  const target = {...createDefaultDroneSettings().oscillators[3],enabled:false};
  const loaded = retargetOscillatorSnapshot(preset.snapshot,target);
  expect(loaded.oscillator).toEqual({...fixture.snapshot.oscillator,id:target.id,enabled:false});
  expect(loaded.modulations).toEqual(fixture.snapshot.modulations.map(modulation =>
    ({...modulation,targetOscillatorId:target.id})));
});

it('rejects unsupported versions and LFOs belonging to another oscillator', () => {
  const fixture = createPresetFixture();
  expect(() => readOscillatorPreset({...fixture,schemaVersion:2})).toThrow(/metadata/);
  const wrongModulations = createDefaultLowFrequencyOscillators(['oscillator-2']);
  expect(() => readOscillatorPreset({...fixture,snapshot:{...fixture.snapshot,modulations:wrongModulations}}))
    .toThrow(/targets/);
});
