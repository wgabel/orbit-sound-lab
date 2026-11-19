import { describe, expect, it } from 'vitest';
import { createDefaultDroneMix } from './drone';
import { getDroneShelfResponseDecibels, getShelfFrequencyHz } from './drone-shelf-response';

describe('combined drone shelf EQ response', () => {
  const defaults = createDefaultDroneMix();

  it('is flat at zero gain', () => {
    for (const frequency of [20, 150, 2400, 20000]) {
      expect(getDroneShelfResponseDecibels(defaults, frequency, 48000)).toBe(0);
    }
  });

  it('reaches half the gain in dB at each shelf frequency', () => {
    const low = {...defaults, lowShelf: {frequencyHz: 150, gainDecibels: 6}};
    const high = {...defaults, highShelf: {frequencyHz: 2400, gainDecibels: -8}};
    expect(getDroneShelfResponseDecibels(low, 150, 48000)).toBeCloseTo(3);
    expect(getDroneShelfResponseDecibels(high, 2400, 48000)).toBeCloseTo(-4);
    expect(getDroneShelfResponseDecibels(low, 20, 48000)).toBeCloseTo(6, 1);
    expect(getDroneShelfResponseDecibels(high, 20000, 48000)).toBeCloseTo(-8, 1);
  });

  it('adds overlapping gain and shares the playback frequency ceiling', () => {
    const both = {...defaults, lowShelf: {frequencyHz: 20000, gainDecibels: 12},
      highShelf: {frequencyHz: 20, gainDecibels: 12}};
    expect(getDroneShelfResponseDecibels(both, 1000, 32000)).toBeCloseTo(24, 1);
    expect(getShelfFrequencyHz(20000, 32000)).toBe(15680);
  });
});
