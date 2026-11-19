import { describe, expect, it } from 'vitest';
import { readOutputContextTime } from './web-audio-output-clock';

describe('Web Audio output clock', () => {
  it('uses the device timestamp on the performance clock without subtracting device latency twice', () => {
    const context = {currentTime:4, baseLatency:0.02, outputLatency:0.08,
      getOutputTimestamp:() => ({contextTime:3.9,performanceTime:4200})};
    expect(readOutputContextTime(context,4216)).toBeCloseTo(3.916);
  });

  it('falls back to reported latencies before the device timestamp is available', () => {
    const context = {currentTime:4, baseLatency:0.02, outputLatency:0.08};
    expect(readOutputContextTime(context,4200)).toBeCloseTo(3.9);
    expect(readOutputContextTime({...context,getOutputTimestamp:() => ({contextTime:0,performanceTime:0})},4200)).toBeCloseTo(3.9);
  });

  it('keeps estimates between the start of the context and the audio already rendered', () => {
    const context = {currentTime:4, getOutputTimestamp:() => ({contextTime:3.9,performanceTime:4200})};
    expect(readOutputContextTime(context,4450)).toBe(4);
    expect(readOutputContextTime({currentTime:0.01,outputLatency:0.08},50)).toBe(0);
  });
});
