import { describe, expect, it, vi } from 'vitest';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillators } from '../domain/modulation';
import type { SynthesizerController } from './audio-contracts';
import { applyInitialSynthesizerSettings } from './apply-initial-synthesizer-settings';

describe('initial synthesizer settings', () => {
  it('applies five oscillator and twenty independent LFO settings before playback', () => {
    const drone = createDefaultDroneSettings();
    const settings = {...drone, oscillators: drone.oscillators.map((oscillator,index) => ({...oscillator, enabled: index === 0, waveform: 'sine' as const}))};
    const controller = {updateOscillator: vi.fn(),setMix: vi.fn(),updateLowFrequencyOscillator: vi.fn()} as unknown as SynthesizerController;
    const modulations = createDefaultLowFrequencyOscillators(settings.oscillators.map(item => item.id));
    applyInitialSynthesizerSettings(controller,settings,modulations);
    expect(controller.updateOscillator).toHaveBeenCalledTimes(5);
    expect(controller.updateOscillator).toHaveBeenNthCalledWith(2,expect.objectContaining({enabled:false,waveform:'sine'}));
    expect(controller.setMix).toHaveBeenCalledWith(settings.mix);
    expect(controller.updateLowFrequencyOscillator).toHaveBeenCalledTimes(20);
    expect(controller.updateLowFrequencyOscillator).toHaveBeenNthCalledWith(20, expect.objectContaining({targetOscillatorId:'oscillator-5'}));
  });
});
