import { limitAutomationSteps, MAXIMUM_AUTOMATION_STEPS, readAutomationPhase, readAutomationValue } from '@domain/patch/automation';
import type { AutomationPlaybackTiming, AutomationPoint, AutomationStepEnvelope, PatchAutomation } from '@domain/patch/automation';
import { readClipElapsed } from '@domain/patch/arrangement';
import type { ArrangementClip } from '@domain/patch/arrangement';
import moduleUrl from './automation-timing.worklet.js?url&no-inline';

export interface AutomationTimingPorts {
  readonly duration: boolean;
  readonly steps: boolean;
}

export interface AutomationTimingRoute extends AutomationTimingPorts {
  readonly factory: WebAudioAutomationTimingFactory;
}

function compileEnvelopedSteps(points: readonly AutomationPoint[], envelope: AutomationStepEnvelope) {
  const {attack,decay,sustain,release} = envelope;
  const sustainStart = attack + decay;
  const releaseStart = Math.max(sustainStart,1 - release);
  // Keep zero-length stages instantaneous. End values belong to each ramp, so
  // the following ramp can start at a different level on the same boundary.
  const stages = [
    {start:0,end:attack,value:0,endValue:1},
    {start:attack,end:sustainStart,value:1,endValue:sustain},
    {start:sustainStart,end:releaseStart,value:sustain,endValue:sustain},
    {start:releaseStart,end:1,value:sustain,endValue:0}
  ].filter(stage => stage.end > stage.start);
  return points.flatMap((point,index) => {
    const next = points[index + 1];
    if (!next) return [{position:1,value:0}];
    const stepDuration = next.position - point.position;
    return stages.map(stage => {
      const position = point.position + stage.start * stepDuration;
      return {position,rampStart:position,value:point.value * stage.value,endValue:point.value * stage.endValue};
    });
  });
}

export function compileAutomationPattern(settings: PatchAutomation) {
  if (settings.shape === 'steps') {
    const variants = Array.from({length:settings.points.length-1},(_,index) => {
      const {points} = limitAutomationSteps(settings,index+1);
      if (settings.stepEnvelope?.enabled) return compileEnvelopedSteps(points,settings.stepEnvelope);
      return points.map((point,position) => {
        const next = points[position+1]?.position ?? 1;
        return {...point,rampStart:next-(next-point.position)*settings.glide};
      });
    });
    return {kind:'steps',variants};
  }
  if (settings.shape === 'square') return {kind:'square'};
  return {kind:'curve',values:Float32Array.from({length:4097},(_,index) => readAutomationValue(settings,index/4096))};
}

function monitor(context: AudioContext, node: AudioWorkletNode, output: number) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 8192;
  const samples = new Float32Array(analyser.fftSize);
  node.connect(analyser,output);
  return (time: number) => {
    analyser.getFloatTimeDomainData(samples);
    const offset = Math.max(0,Math.round((context.currentTime-time)*context.sampleRate));
    return samples[Math.max(0,samples.length-1-offset)];
  };
}

export class WebAudioAutomationTimingFactory {
  private readonly registration: Promise<boolean>;
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => true).catch(() => false)
      ?? Promise.resolve(false);
  }

  async prepare(): Promise<void> {
    this.ready = await this.registration;
  }

  create(settings: PatchAutomation, start: number, elapsed: number, duration: number, end: number) {
    if (!this.ready) throw new Error('Duration and Step count inputs need AudioWorklet in this browser.');
    const {context} = this;
    const node = new AudioWorkletNode(context,'orbit-automation-timing',{
      numberOfInputs:0,numberOfOutputs:3,outputChannelCount:[1,1,1],
      parameterData:{duration,steps:MAXIMUM_AUTOMATION_STEPS},
      processorOptions:{duration,phase:readAutomationPhase({...settings,duration},elapsed),pattern:compileAutomationPattern(settings),
        mode:settings.mode,startFrame:Math.round(start*context.sampleRate),endFrame:Math.round(end*context.sampleRate)}
    });
    const phase = monitor(context,node,1);
    const steps = settings.shape === 'steps' ? monitor(context,node,2) : undefined;
    return {
      node,
      read(time: number): AutomationPlaybackTiming {
        return {phase:phase(time),stepCount:steps && Math.max(1,Math.round(steps(time)*MAXIMUM_AUTOMATION_STEPS))};
      },
      dispose() {
        node.port.postMessage('stop');
        node.port.close();
        node.disconnect();
      }
    };
  }
}

export function createAutomationTimingSignal(context: AudioContext, settings: PatchAutomation, origin: number,
  route: AutomationTimingRoute, clips?: readonly ArrangementClip[]) {
  const output = context.createGain();
  const duration = route.duration ? context.createConstantSource() : undefined;
  const steps = route.steps ? context.createConstantSource() : undefined;
  if (duration) {duration.offset.value = settings.duration; duration.start();}
  if (steps) {steps.offset.value = MAXIMUM_AUTOMATION_STEPS; steps.start();}
  const windows: Array<{start:number; end:number; signal:ReturnType<WebAudioAutomationTimingFactory['create']>}> = [];

  function schedule(curve: PatchAutomation, start: number, elapsed: number, end = Infinity) {
    const baseDuration = duration ? settings.duration : curve.duration;
    const signal = route.factory.create(curve,start,elapsed,baseDuration,end);
    windows.push({start,end,signal});
    signal.node.connect(output);
    if (duration) {
      const parameter = signal.node.parameters.get('duration');
      if (!parameter) throw new Error('Automation Duration input is unavailable.');
      parameter.value = 0;
      duration.connect(parameter);
    }
    if (steps) {
      const parameter = signal.node.parameters.get('steps');
      if (!parameter) throw new Error('Automation Step count input is unavailable.');
      parameter.value = 0;
      steps.connect(parameter);
    }
  }

  function dispose() {
    for (const {signal} of windows) signal.dispose();
    for (const control of [duration,steps]) if (control) {control.stop(); control.disconnect();}
    output.disconnect();
  }

  try {
    if (clips) {
      for (const clip of clips) {
        const start = Math.max(context.currentTime,origin+clip.start);
        const end = origin+clip.start+clip.duration;
        if (start < end) schedule(clip.automation ?? settings,start,Math.max(0,readClipElapsed(clip,start-origin)),end);
      }
    } else {
      const start = context.currentTime;
      schedule(settings,start,Math.max(0,start-origin));
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    output,
    parameters:{
      ...(duration ? {duration:{parameter:duration.offset,base:settings.duration}} : {}),
      ...(steps ? {steps:{parameter:steps.offset,base:MAXIMUM_AUTOMATION_STEPS}} : {})
    },
    readTiming(elapsed: number) {
      const time = origin+elapsed;
      return windows.find(window => window.start <= time && time < window.end)?.signal.read(time);
    },
    dispose
  };
}
