import workletSource from './smooth-random-lfo.worklet.js?raw';
import { expect, it } from 'vitest';

interface WorkletInstance {
  readonly port: {onmessage: () => void};
  process(inputs: unknown[], outputs: Float32Array[][], parameters: {rate: Float32Array}): boolean;
}

it('reaches different random targets at the selected period with smooth, bounded transitions', () => {
  const randomValues = [0.9, 0.2, 0.65];
  const processors = new Map<string, new () => WorkletInstance>();
  const registerWorklet = new Function('AudioWorkletProcessor', 'sampleRate', 'Math', 'registerProcessor', workletSource);
  registerWorklet(
    class { readonly port = {}; },
    100,
    {random: () => randomValues.shift() ?? 0.5},
    (name: string, Processor: new () => WorkletInstance) => processors.set(name, Processor)
  );
  const Processor = processors.get('smooth-random-lfo');
  if (!Processor) throw new Error('Smooth Random worklet did not register.');
  const processor = new Processor();
  const samples = new Float32Array(101);
  expect(processor.process([], [[samples]], {rate: new Float32Array([2])})).toBe(true);
  expect(samples[0]).toBe(0);
  expect(samples[25]).toBeCloseTo(0.4);
  expect(samples[50]).toBeCloseTo(0.8);
  expect(samples[75]).toBeCloseTo(0.1);
  expect(samples[100]).toBeCloseTo(-0.6);
  expect(samples.every(sample => sample >= -1 && sample <= 1)).toBe(true);
  expect(Math.abs(samples[51] - samples[49])).toBeLessThan(0.01);
  processor.port.onmessage();
  expect(processor.process([], [[samples]], {rate: new Float32Array([2])})).toBe(false);
});
