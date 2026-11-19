import { expect, it } from 'vitest';
import workletSource from './pulse.worklet.js?raw';
import { MAXIMUM_PULSE_WIDTH, MINIMUM_PULSE_WIDTH } from '../../domain/drone';

interface PulseProcessor {
  readonly port: {onmessage: () => void};
  process(inputs: unknown[], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

function createProcessor() {
  type Constructor = new (options: {processorOptions: {minimumWidth: number; maximumWidth: number}}) => PulseProcessor;
  const processors = new Map<string, Constructor>();
  const register = new Function('AudioWorkletProcessor', 'sampleRate', 'registerProcessor', workletSource);
  register(class { readonly port = {}; }, 48000, (name: string, processor: Constructor) => processors.set(name, processor));
  const Processor = processors.get('orbit-pulse');
  if (!Processor) throw new Error('Pulse worklet did not register.');
  return new Processor({processorOptions: {minimumWidth: MINIMUM_PULSE_WIDTH, maximumWidth: MAXIMUM_PULSE_WIDTH}});
}

function render(processor: PulseProcessor, width: number, gate = 1, detune = 0) {
  const output = new Float32Array(4800);
  const running = processor.process([], [[output]], {
    frequency: new Float32Array([100]), detune: new Float32Array([detune]),
    shape: new Float32Array([width]), gate: new Float32Array([gate])
  });
  return {output, running};
}

it('changes the duty cycle while keeping static pulses centered at zero', () => {
  for (const width of [0.05, 0.25, 0.5, 0.8, 0.95]) {
    const {output} = render(createProcessor(), width);
    expect(output.filter(sample => sample > 0).length / output.length).toBeCloseTo(width, 2);
    expect(output.reduce((sum, sample) => sum + sample, 0) / output.length).toBeCloseTo(0, 5);
    expect(output.every(sample => Math.abs(sample) <= 1)).toBe(true);
  }
});

it('uses detune and gates output on the shared playback schedule', () => {
  const processor = createProcessor();
  expect(render(processor, 0.5, 0).output.every(sample => sample === 0)).toBe(true);
  const {output} = render(processor, 0.5, 1, 1200);
  const positiveEdges = output.filter((sample, index) => index > 0 && sample > 0 && output[index - 1] <= 0);
  expect(positiveEdges).toHaveLength(20);
  processor.port.onmessage();
  expect(render(processor, 0.5).running).toBe(false);
});
