import { describe, expect, it } from 'vitest';
import { createDefaultDroneSettings } from './drone';
import { createDefaultLowFrequencyOscillators } from './modulation';
import { retargetOscillatorSnapshot } from './oscillator-clipboard';

describe('oscillator clipboard', () => {
  it('copies the sound and three LFOs into the target slot', () => {
    const [first, second] = createDefaultDroneSettings().oscillators;
    const oscillator = {...first, frequencyHz: 154, pan: -0.25, waveform: 'triangle' as const};
    const target = {...second, enabled: false};
    const modulations = createDefaultLowFrequencyOscillators([first.id]).map(item => ({...item, enabled: true}));
    const snapshot = retargetOscillatorSnapshot({oscillator, modulations}, target);
    expect(snapshot.oscillator).toEqual({...oscillator, id: target.id, enabled: false});
    expect(snapshot.modulations).toEqual(modulations.map(item => ({...item, targetOscillatorId: target.id})));
    expect(modulations.every(item => item.targetOscillatorId === first.id)).toBe(true);
  });
});
