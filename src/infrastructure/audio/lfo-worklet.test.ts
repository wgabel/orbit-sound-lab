import workletSource from './lfo.worklet.js?raw';
import { expect, it } from 'vitest';
import type { LfoWorkletConfiguration } from './web-audio-lfo-worklet';

interface WorkletInstance {
  readonly port: {onmessage: (event: {data: string | LfoWorkletConfiguration}) => void};
  process(inputs: unknown[], outputs: Float32Array[][], parameters: {rate: Float32Array}): boolean;
}

function createProcessor(configuration: LfoWorkletConfiguration, firstFrame = 0, randomValues: number[] = []) {
  type Constructor = new (options: {processorOptions: {configuration: LfoWorkletConfiguration; seed: number}}) => WorkletInstance;
  const processors = new Map<string, Constructor>();
  const registerWorklet = new Function('AudioWorkletProcessor', 'sampleRate', 'currentFrame', 'Math', 'registerProcessor', workletSource);
  const math = Object.assign(Object.create(Math), {random: () => randomValues.shift() ?? 0.5});
  registerWorklet(
    class { readonly port = {}; },
    100,
    firstFrame,
    math,
    (name: string, Processor: Constructor) => processors.set(name, Processor)
  );
  const Processor = processors.get('orbit-lfo');
  if (!Processor) throw new Error('LFO worklet did not register.');
  return new Processor({processorOptions: {configuration, seed: 43}});
}

function render(processor: WorkletInstance, length: number) {
  const samples = new Float32Array(length);
  expect(processor.process([], [[samples]], {rate: new Float32Array([2])})).toBe(true);
  return samples;
}

it('reaches different free-running random targets within the selected period', () => {
  const configuration = {waveform: 'smoothRandom', synchronized: false, phaseDegrees: 0, frequencyHz: 2} as const;
  const processor = createProcessor(configuration, 0, [0.9, 0.2, 0.65]);
  const samples = render(processor, 101);
  expect(samples[0]).toBe(0);
  expect(samples[25]).toBeCloseTo(0.4);
  expect(samples[50]).toBeCloseTo(0.8);
  expect(samples[75]).toBeCloseTo(0.1);
  expect(samples[100]).toBeCloseTo(-0.6);
  expect(samples.every(sample => sample >= -1 && sample <= 1)).toBe(true);
  expect(Math.abs(samples[51] - samples[49])).toBeLessThan(0.01);
  processor.port.onmessage({data: 'stop'});
  expect(processor.process([], [[samples]], {rate: new Float32Array([2])})).toBe(false);
});

it('aligns a later sine LFO to the common clock and offsets opposite phase', () => {
  const configuration = {waveform: 'sine', synchronized: true, phaseDegrees: 0, frequencyHz: 2} as const;
  const active = render(createProcessor(configuration), 140).subarray(73);
  const late = render(createProcessor(configuration, 73), 67);
  const opposite = render(createProcessor({...configuration, phaseDegrees: 180}, 73), 67);
  expect(late).toEqual(active);
  for (const [index, sample] of late.entries()) expect(opposite[index]).toBeCloseTo(-sample, 6);
});

it('shares synced random targets even when the second LFO starts later', () => {
  const configuration = {waveform: 'smoothRandom', synchronized: true, phaseDegrees: 0, frequencyHz: 2} as const;
  const active = render(createProcessor(configuration, 0, [0.9]), 180);
  const late = render(createProcessor(configuration, 80, [0.1]), 100);
  expect(late).toEqual(active.subarray(80));
  expect(new Set(late).size).toBeGreaterThan(40);
});
