class SmoothRandomLfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{name: 'rate', defaultValue: 0.2, minValue: 0.01, maxValue: 20, automationRate: 'k-rate'}];
  }

  constructor() {
    super();
    this.phase = 0;
    this.previous = 0;
    this.target = this.randomTarget();
    this.running = true;
    this.port.onmessage = () => { this.running = false; };
  }

  randomTarget() {
    return Math.random() * 2 - 1;
  }

  process(_inputs, outputs, parameters) {
    if (!this.running) return false;
    const output = outputs[0][0];
    if (!output) return true;
    const increment = parameters.rate[0] / sampleRate;
    for (let index = 0; index < output.length; index++) {
      // Smoothstep keeps both the value and its slope continuous at each new target.
      const progress = this.phase * this.phase * (3 - 2 * this.phase);
      output[index] = this.previous + (this.target - this.previous) * progress;
      this.phase += increment;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.previous = this.target;
        this.target = this.randomTarget();
      }
    }
    return true;
  }
}

registerProcessor('smooth-random-lfo', SmoothRandomLfoProcessor);
