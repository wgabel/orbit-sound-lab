import { describe, expect, it } from 'vitest';
import { readAutomationValue, validateAutomation } from '@domain/patch/automation';
import type { PatchAutomation } from '@domain/patch/automation';
import { applyHarmonicsPreset, HARMONICS_GROUPS, readHarmonicsPresetId } from '@domain/patch/harmonics';

const initial: PatchAutomation = {
  shape:'sine', duration:3.5, mode:'once', glide:0.2,
  points:[{position:0,value:0},{position:1,value:1}]
};

describe('automation harmonics presets', () => {
  it('writes playable held steps, preserving the transport settings for every preset', () => {
    for (const {id, semitones} of HARMONICS_GROUPS.flatMap(group => group.presets)) {
      const settings = applyHarmonicsPreset(initial,id);
      expect(() => validateAutomation(settings)).not.toThrow();
      expect(settings).toMatchObject({shape:'steps', glide:0, duration:3.5, mode:'once'});
      expect(settings.points).toHaveLength(semitones.length + 1);
      expect(settings.points.at(-1)?.value).toBe(settings.points.at(-2)?.value);
      expect(readAutomationValue(settings,1)).toBe(settings.points.at(-2)?.value);
      expect(readHarmonicsPresetId(settings)).toBe(id);
    }
  });

  it('produces the intended frequencies over an octave-wide linear cable', () => {
    for (const root of [55,110,220]) {
      const settings = applyHarmonicsPreset(initial,'major');
      for (const [index,note] of [0,4,7,12,7,4].entries()) {
        const value = readAutomationValue(settings,(index + 0.5) / 6);
        expect(root + value * root).toBeCloseTo(root * 2 ** (note / 12),2);
      }
    }
  });

  it('lets users customize steps and reapply the preset', () => {
    const preset = applyHarmonicsPreset(initial,'dorian');
    const edited = {...preset, points:preset.points.map((point,index) => index === 1 ? {...point,value:0.5} : point)};
    expect(readHarmonicsPresetId(edited)).toBe('');
    expect(applyHarmonicsPreset(edited,'dorian')).toEqual(preset);
    expect(applyHarmonicsPreset(initial,'')).toBe(initial);
  });
});
