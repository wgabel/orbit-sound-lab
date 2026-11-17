import { describe, expect, it, vi } from 'vitest';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { SynthesizerController } from './audio-contracts';
import { applyInitialSynthesizerSettings } from './apply-initial-synthesizer-settings';
describe('initial synthesizer settings', () => {
  it('applies oscillator enablement, waveform, gain and LFO before playback', () => {
    const drone = createDefaultDroneSettings();
    const settings = {...drone, gain: 0.08, oscillators: drone.oscillators.map((oscillator,index) => ({...oscillator, enabled: index === 0, waveform: 'sine' as const}))};
    const controller = {updateOscillator: vi.fn(),setGain: vi.fn(),updateLowFrequencyOscillator: vi.fn()} as unknown as SynthesizerController;
    const modulation = createDefaultLowFrequencyOscillatorSettings();
    applyInitialSynthesizerSettings(controller,settings,modulation);
    expect(controller.updateOscillator).toHaveBeenCalledTimes(5);
    expect(controller.updateOscillator).toHaveBeenNthCalledWith(2,expect.objectContaining({enabled:false,waveform:'sine'}));
    expect(controller.setGain).toHaveBeenCalledWith(0.08);
    expect(controller.updateLowFrequencyOscillator).toHaveBeenCalledWith(modulation);
  });
});
