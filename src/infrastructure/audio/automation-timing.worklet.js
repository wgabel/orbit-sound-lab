/** Advances a normalized Automation phase on the audio clock at the incoming duration. */
class OrbitAutomationTimingProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {name:'duration',defaultValue:8,minValue:0,maxValue:60,automationRate:'a-rate'},
      {name:'steps',defaultValue:31,minValue:0,maxValue:31,automationRate:'k-rate'}
    ];
  }

  constructor({processorOptions}) {
    super();
    const {phase,duration,mode,startFrame,endFrame,pattern} = processorOptions;
    this.phase = phase;
    this.duration = duration;
    this.slew = 1-Math.exp(-1/(sampleRate*0.008));
    this.loop = mode === 'loop';
    this.startFrame = startFrame;
    this.endFrame = endFrame;
    this.pattern = pattern;
    this.stopped = false;
    this.port.onmessage = event => {if (event.data === 'stop') this.stopped = true;};
  }

  readValue(phase, steps) {
    if (this.pattern.kind === 'steps') {
      const points = this.pattern.variants[steps-1];
      for (let index = 0; index < points.length-1; index++) {
        const point = points[index];
        const next = points[index+1];
        if (phase >= next.position) continue;
        if (phase <= point.rampStart) return point.value;
        return point.value + (next.value-point.value)*(phase-point.rampStart)/(next.position-point.rampStart);
      }
      return points.at(-1).value;
    }
    if (this.pattern.kind === 'square') return phase < 0.5 ? 0 : 1;
    const values = this.pattern.values;
    const position = phase*(values.length-1);
    const index = Math.floor(position);
    const fraction = position-index;
    return values[index]+(values[Math.min(index+1,values.length-1)]-values[index])*fraction;
  }

  process(_inputs, [[values],[phases],[stepCounts]], {duration,steps}) {
    if (this.stopped) return false;
    const count = this.pattern.kind === 'steps'
      ? Math.min(this.pattern.variants.length,Math.max(1,Math.round(steps[0]))) : 0;
    for (let index = 0; index < values.length; index++) {
      const frame = currentFrame+index;
      if (frame < this.startFrame || frame >= this.endFrame) continue;
      const target = Math.max(0.05,Math.min(60,duration.length === 1 ? duration[0] : duration[index]));
      this.duration += (target-this.duration)*this.slew;
      values[index] = this.readValue(this.phase,count);
      phases[index] = this.phase;
      stepCounts[index] = count/31;
      const next = this.phase + 1/(sampleRate*this.duration);
      this.phase = this.loop ? next%1 : Math.min(1,next);
    }
    return currentFrame+values.length < this.endFrame;
  }
}

registerProcessor('orbit-automation-timing',OrbitAutomationTimingProcessor);
