import { describe, expect, it } from 'vitest';
import { readAutomationSettings } from './automation-preset';
import { readAutomationValue, validateAutomation } from './patch-automation';
import type { PatchAutomation } from './patch-automation';
import { applySmoothWavePreset, readSmoothWavePresetId, SMOOTH_WAVE_PRESETS } from './patch-smooth-waves';

const base: PatchAutomation = {shape:'curve',duration:6.5,mode:'once',glide:0,
  points:[{position:0,value:0},{position:1,value:1}]};

describe('smooth automation waves', () => {
  it.each(SMOOTH_WAVE_PRESETS)('preserves timing and loops seamlessly for $label', preset => {
    const settings = applySmoothWavePreset(base,preset.id);
    expect(settings).toMatchObject({shape:'smoothCurve',duration:6.5,mode:'once'});
    expect(readSmoothWavePresetId(settings)).toBe(preset.id);
    expect(() => validateAutomation(settings)).not.toThrow();
    expect(readAutomationSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
    const start = readAutomationValue(settings,0);
    expect(readAutomationValue(settings,1)).toBeCloseTo(start,10);
    const interval = 0.0001;
    expect(Math.abs(readAutomationValue(settings,interval) - start)/interval).toBeLessThan(0.01);
    expect(Math.abs(readAutomationValue(settings,1-interval) - start)/interval).toBeLessThan(0.01);
  });

  it('eases between editable points without changing ordinary linear curves', () => {
    expect(readAutomationValue(base,0.25)).toBe(0.25);
    expect(readAutomationValue({...base,shape:'smoothCurve'},0.25)).toBe(0.15625);
    expect(readAutomationValue({...base,shape:'smoothCurve'},0.75)).toBe(0.84375);
    const preset = applySmoothWavePreset(base,'slow-breath');
    const edited = {...preset,points:preset.points.map((point,index) => index === 1 ? {...point,value:0.7} : point)};
    expect(readAutomationValue(edited,0.5)).toBe(0.7);
    expect(readSmoothWavePresetId(edited)).toBe('');
    expect(applySmoothWavePreset(edited,'slow-breath')).toEqual(preset);
  });
});
