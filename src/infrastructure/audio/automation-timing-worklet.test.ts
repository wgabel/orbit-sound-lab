import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTOMATION_STEP_ENVELOPE, limitAutomationSteps, readAutomationValue } from '../../domain/patch-automation';
import type { PatchAutomation } from '../../domain/patch-automation';
import { compileAutomationPattern } from './web-audio-automation-timing';
import workletSource from './automation-timing.worklet.js?raw';

const sampleRate = 1000;
interface Options {
  duration: number;
  phase: number;
  mode: 'loop' | 'once';
  startFrame: number;
  endFrame: number;
  pattern: object;
}
interface TimingProcessor {
  port: {onmessage(event: {data:string}): void};
  process(inputs: unknown[], outputs: Float32Array[][], parameters: {duration: Float32Array; steps: Float32Array}): boolean;
}

function createTimingProcessor(options: Partial<Options> = {}) {
  type Constructor = new (options: {processorOptions: Options}) => TimingProcessor;
  const registry = new Map<string,Constructor>();
  const register = new Function('AudioWorkletProcessor','sampleRate','currentFrame','registerProcessor',workletSource);
  register(class {readonly port = {};},sampleRate,0,(name: string, processor: Constructor) => registry.set(name,processor));
  const Processor = registry.get('orbit-automation-timing');
  if (!Processor) throw new Error('Automation timing worklet did not register.');
  return new Processor({processorOptions:{duration:1,phase:0,mode:'loop',startFrame:0,endFrame:Infinity,
    pattern:{kind:'curve',values:[0,1]},...options}});
}

function render(processor: TimingProcessor, frames: number, duration: Float32Array, stepCount = 31) {
  const output = [new Float32Array(frames),new Float32Array(frames),new Float32Array(frames)];
  const running = processor.process([],output.map(samples => [samples]),{duration,steps:new Float32Array([stepCount])});
  return {value:output[0],phase:output[1],steps:output[2],running};
}

describe('Automation node timing', () => {
  it('integrates a changing duration without jumping phase', () => {
    const duration = new Float32Array(800);
    duration.fill(1,0,400);
    duration.fill(0.5,400);
    const {phase} = render(createTimingProcessor(),800,duration);
    expect(phase[399]).toBeCloseTo(0.399,3);
    expect(phase[400]-phase[399]).toBeLessThan(0.002);
    expect(phase[600]-phase[500]).toBeCloseTo(0.2,2);
  });

  it('rounds the active count, uses only the chosen prefix, and caps at the available steps', () => {
    const short = [{position:0,value:0.2,rampStart:1},{position:1,value:0.2}];
    const full = [{position:0,value:0.2,rampStart:0.5},{position:0.5,value:0.8,rampStart:1},{position:1,value:0.8}];
    const pattern = {kind:'steps',variants:[short,full]};
    const one = render(createTimingProcessor({pattern}),800,new Float32Array([1]),1.4);
    const two = render(createTimingProcessor({pattern}),800,new Float32Array([1]),9);
    expect(one.value[700]).toBeCloseTo(0.2);
    expect(one.steps[700]*31).toBeCloseTo(1);
    expect(two.value[700]).toBeCloseTo(0.8);
    expect(two.steps[700]*31).toBeCloseTo(2);
  });

  it('matches the step envelope preview after a clip offset and a step count reduction', () => {
    const settings: PatchAutomation = {duration:1,mode:'once',shape:'steps',glide:0.5,
      points:[{position:0,value:0.8},{position:0.2,value:0.6},{position:0.55,value:1},{position:1,value:1}],
      stepEnvelope:{...DEFAULT_AUTOMATION_STEP_ENVELOPE,enabled:true}};
    const processor = createTimingProcessor({phase:0.1,mode:'once',pattern:compileAutomationPattern(settings)});
    const timing = render(processor,1000,new Float32Array([1]),2);
    const visibleSteps = limitAutomationSteps(settings,2);
    for (const [index,value] of timing.value.entries()) {
      expect(value).toBeCloseTo(readAutomationValue(visibleSteps,timing.phase[index]),5);
    }
    expect(timing.value[999]).toBe(0);
  });

  it('honors clip frames and holds the ending in once mode', () => {
    const processor = createTimingProcessor({duration:0.1,mode:'once',startFrame:10,endFrame:200});
    const timing = render(processor,210,new Float32Array([0.1]));
    expect(timing.value[5]).toBe(0);
    expect(timing.value[150]).toBe(1);
    expect(timing.value[205]).toBe(0);
    expect(timing.running).toBe(false);
  });
});
