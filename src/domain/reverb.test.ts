import { describe, expect, it } from 'vitest';
import { createPatchModule, getPatchPort, validatePatch } from './patch';
import type { Patch } from './patch';
import { DEFAULT_REVERB, REVERB_PRESETS, resolveReverb, validateDroneReverb, validateReverb } from './reverb';

describe('reverb settings', () => {
  it('uses the original space for old drone presets and preserves their wet mix', () => {
    const legacy = {enabled:true,mix:0.67};
    expect(resolveReverb(legacy)).toEqual({...DEFAULT_REVERB,mix:0.67});
    expect(() => validateDroneReverb(legacy)).not.toThrow();
  });

  it('checks new parameters even when drone reverb is bypassed', () => {
    expect(() => validateDroneReverb({enabled:false,mix:0.3,decaySeconds:13})).toThrow(/decay/);
    expect(() => validateDroneReverb({enabled:false,mix:0.3,preDelayMilliseconds:-1})).toThrow(/pre-delay/);
    expect(() => validateDroneReverb({enabled:false,mix:0.3,damping:NaN})).toThrow(/damping/);
    for (const preset of REVERB_PRESETS) expect(() => validateReverb(preset.settings)).not.toThrow();
  });

  it('accepts Wet Mix automation in a saved patch and bounds its mapping', () => {
    const reverb = createPatchModule('reverb','room');
    const automation = createPatchModule('automation','curve');
    const cable = {id:'wet-mix',source:{moduleId:'curve',portId:'control'},
      destination:{moduleId:'room',portId:'mix'},mapping:{from:0,to:1}};
    const patch: Patch = {version:1,modules:[automation,reverb],cables:[cable]};
    expect(() => validatePatch(JSON.parse(JSON.stringify(patch)))).not.toThrow();
    expect(getPatchPort(patch,cable.destination)?.parameter).toEqual({unit:'%',minimum:0,maximum:1,displayScale:100});
    expect(() => validatePatch({...patch,cables:[{...cable,mapping:{from:0,to:1.01}}]})).toThrow();
  });
});
