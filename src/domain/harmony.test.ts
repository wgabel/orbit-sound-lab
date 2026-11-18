import {describe,expect,it} from 'vitest';
import {DEFAULT_HARMONY_SETTINGS,getHarmonicFrequency,validateHarmonySettings} from './harmony';
describe('harmony engine',()=>{
  const natural={...DEFAULT_HARMONY_SETTINGS,mode:'natural' as const,chord:'major' as const};
  it('uses pure natural major ratios',()=>{
    expect(getHarmonicFrequency(natural,0)).toBeCloseTo(110);
    expect(getHarmonicFrequency(natural,1)).toBeCloseTo(137.5);
    expect(getHarmonicFrequency(natural,2)).toBeCloseTo(165);
  });
  it('quantizes piano intervals to equal temperament',()=>{
    const piano={...natural,mode:'piano' as const};
    expect(getHarmonicFrequency(piano,1)).toBeCloseTo(110*Math.pow(2,4/12));
  });
  it('applies symmetric spread in cents',()=>{
    const spread={...natural,spreadCents:20};
    expect(getHarmonicFrequency(spread,0)).toBeCloseTo(110*Math.pow(2,-20/1200));
    expect(getHarmonicFrequency(spread,4)).toBeCloseTo(275*Math.pow(2,20/1200));
  });
  it('rejects invalid inputs and free mode tuning',()=>{
    expect(()=>validateHarmonySettings({...natural,rootFrequencyHz:0})).toThrow();
    expect(()=>getHarmonicFrequency(DEFAULT_HARMONY_SETTINGS,0)).toThrow();
    expect(()=>getHarmonicFrequency(natural,5)).toThrow();
  });
});
