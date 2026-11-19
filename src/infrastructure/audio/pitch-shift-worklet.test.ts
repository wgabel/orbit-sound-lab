import { describe, expect, it } from 'vitest';
import workletSource from './pitch-shift.worklet.js?raw';

const sampleRate = 48000;
interface PitchProcessor {
  readonly port: {onmessage(event: {data: string}): void};
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: {semitones: Float32Array}): boolean;
}

function createProcessor(cents = 0, semitones = 0) {
  type ProcessorConstructor = new (options: {processorOptions: {cents: number; semitones: number}}) => PitchProcessor;
  const processors = new Map<string, ProcessorConstructor>();
  const register = new Function('AudioWorkletProcessor','sampleRate','registerProcessor',workletSource);
  register(class {readonly port = {};},sampleRate,(name: string, processor: ProcessorConstructor) => processors.set(name,processor));
  const Processor = processors.get('orbit-pitch-shift');
  if (!Processor) throw new Error('Pitch Shift worklet did not register.');
  return new Processor({processorOptions:{cents,semitones}});
}

function render(processor: PitchProcessor, semitones: Float32Array) {
  const input = [220,330].map(frequency => Float32Array.from({length:sampleRate},(_,index) =>
    Math.sin(index*2*Math.PI*frequency/sampleRate)*0.7));
  const output = input.map(channel => new Float32Array(channel.length));
  const running = processor.process([input],[output],{semitones});
  return {input,output,running};
}

function readFrequency(samples: Float32Array, from: number, to: number): number {
  const start = Math.round(from*sampleRate);
  const end = Math.round(to*sampleRate);
  let positiveCrossings = 0;
  for (let index = start; index < end; index++) {
    if (samples[index-1] < 0 && samples[index] >= 0) positiveCrossings++;
  }
  return positiveCrossings/(to-from);
}

describe('audio-rate pitch shift', () => {
  it('passes both channels at unison and stops when disposed', () => {
    const processor = createProcessor();
    const {input,output} = render(processor,new Float32Array([0]));
    expect(output).toEqual(input);
    processor.port.onmessage({data:'stop'});
    expect(render(processor,new Float32Array([0])).running).toBe(false);
  });

  it('applies positive and negative automation within the same render and preserves stereo', () => {
    const semitones = new Float32Array(sampleRate);
    semitones.fill(12,0,sampleRate/2);
    semitones.fill(-12,sampleRate/2);
    const {output} = render(createProcessor(),semitones);
    for (const [index,frequency] of [220,330].entries()) {
      expect(Math.abs(readFrequency(output[index],0.18,0.48)-frequency*2)).toBeLessThan(24);
      expect(Math.abs(readFrequency(output[index],0.68,0.98)-frequency/2)).toBeLessThan(14);
      expect(output[index].every(value => Number.isFinite(value) && Math.abs(value) <= 0.701)).toBe(true);
    }
  });

  it('adds the manual fine tune to the automated transpose', () => {
    const {input,output} = render(createProcessor(-100,1),new Float32Array([1]));
    expect(output).toEqual(input);
  });
});
