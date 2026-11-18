const FULL_TURN = 2 * Math.PI;

function smoothstep(phase) {
  return phase * phase * (3 - 2 * phase);
}

function randomLevelAtCycle(cycle, seed) {
  let value = (cycle + seed) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x80000000 - 1;
}

class LfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{name: 'rate', defaultValue: 0.2, minValue: 0.01, maxValue: 20, automationRate: 'k-rate'}];
  }

  constructor({processorOptions}) {
    super();
    this.configuration = processorOptions.configuration;
    this.seed = processorOptions.seed;
    this.phase = 0;
    this.previous = 0;
    this.target = this.randomTarget();
    this.randomCycle = null;
    this.running = true;
    this.lastSample = null;
    this.transitionLength = Math.max(1, Math.round(sampleRate * 0.02));
    this.transitionRemaining = 0;
    this.port.onmessage = ({data}) => {
      if (data === 'stop') {
        this.running = false;
        return;
      }
      const current = this.configuration;
      if (data.waveform === current.waveform && data.synchronized === current.synchronized &&
          data.phaseDegrees === current.phaseDegrees && (!data.synchronized || data.frequencyHz === current.frequencyHz)) return;
      this.configuration = data;
      if (this.lastSample !== null) {
        this.transitionFrom = this.lastSample;
        this.transitionRemaining = this.transitionLength;
      }
    };
  }

  randomTarget() {
    return Math.random() * 2 - 1;
  }

  synchronizedSample(frame, configuration) {
    // All nodes in this context calculate phase from the same audio render frame.
    const cycles = (frame / sampleRate) * configuration.frequencyHz + configuration.phaseDegrees / 360;
    const cycle = Math.floor(cycles);
    const phase = cycles - cycle;
    switch (configuration.waveform) {
      case 'sine': return Math.sin(FULL_TURN * phase);
      case 'triangle': return 1 - 4 * Math.abs(phase - 0.5);
      case 'square': return phase < 0.5 ? 1 : -1;
      case 'sawtooth': return 2 * phase - 1;
      case 'smoothRandom':
        if (this.randomCycle !== cycle) {
          this.randomCycle = cycle;
          this.synchronizedPrevious = randomLevelAtCycle(cycle, this.seed);
          this.synchronizedTarget = randomLevelAtCycle(cycle + 1, this.seed);
        }
        return this.synchronizedPrevious + (this.synchronizedTarget - this.synchronizedPrevious) * smoothstep(phase);
    }
  }

  freeRandomSample(increment) {
    const sample = this.previous + (this.target - this.previous) * smoothstep(this.phase);
    this.phase += increment;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.previous = this.target;
      this.target = this.randomTarget();
    }
    return sample;
  }

  process(_inputs, outputs, parameters) {
    if (!this.running) return false;
    const output = outputs[0]?.[0];
    if (!output) return true;
    const configuration = this.configuration;
    const increment = parameters.rate[0] / sampleRate;
    for (let index = 0; index < output.length; index++) {
      const sample = configuration.synchronized
        ? this.synchronizedSample(currentFrame + index, configuration)
        : this.freeRandomSample(increment);
      if (this.transitionRemaining > 0) {
        const mix = 1 - this.transitionRemaining-- / this.transitionLength;
        output[index] = this.transitionFrom + (sample - this.transitionFrom) * mix;
      } else {
        output[index] = sample;
      }
      this.lastSample = output[index];
    }
    return true;
  }
}

registerProcessor('orbit-lfo', LfoProcessor);
