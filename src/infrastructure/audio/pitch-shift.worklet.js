/** Two overlapping variable-delay grains with a shared phase for both stereo channels. */
class OrbitPitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{name:'semitones', defaultValue:0, minValue:-24, maxValue:24, automationRate:'a-rate'}];
  }

  constructor({processorOptions = {}} = {}) {
    super();
    this.fineTune = (processorOptions.cents ?? 0)/100;
    this.shift = (processorOptions.semitones ?? 0) + this.fineTune;
    this.smoothing = 1 - Math.exp(-1/(sampleRate*0.008));
    this.depthFrames = Math.ceil(sampleRate*0.085);
    this.minimumDelay = Math.ceil(sampleRate*0.002);
    const capacity = 2 ** Math.ceil(Math.log2(this.depthFrames+this.minimumDelay+2));
    this.mask = capacity-1;
    this.channels = [new Float32Array(capacity),new Float32Array(capacity)];
    this.write = 0;
    this.phase = 0;
    this.active = true;
    this.port.onmessage = event => {
      if (event.data === 'stop') this.active = false;
    };
  }

  read(buffer, delay) {
    const position = this.write-delay;
    const first = Math.floor(position);
    const fraction = position-first;
    const before = buffer[first & this.mask];
    return before + (buffer[(first+1) & this.mask]-before)*fraction;
  }

  process([input], [output], {semitones}) {
    if (!this.active) return false;
    for (let index = 0; index < output[0].length; index++) {
      const target = (semitones.length === 1 ? semitones[0] : semitones[index]) + this.fineTune;
      this.shift += (target-this.shift)*this.smoothing;
      const ratio = 2 ** (this.shift/12);
      this.phase += (1-ratio)/this.depthFrames;
      this.phase -= Math.floor(this.phase);
      const secondPhase = this.phase < 0.5 ? this.phase+0.5 : this.phase-0.5;
      const firstDelay = this.minimumDelay + this.phase*this.depthFrames;
      const secondDelay = this.minimumDelay + secondPhase*this.depthFrames;
      const firstWeight = Math.sin(Math.PI*this.phase) ** 2;
      // Blend back to the dry signal around zero so a stationary delay does not color unison.
      const wet = Math.min(1,Math.abs(this.shift)*5);
      for (let channel = 0; channel < output.length; channel++) {
        const sample = input?.[channel]?.[index] ?? 0;
        const buffer = this.channels[channel];
        buffer[this.write] = sample;
        const shifted = firstWeight*this.read(buffer,firstDelay) + (1-firstWeight)*this.read(buffer,secondDelay);
        output[channel][index] = sample + wet*(shifted-sample);
      }
      this.write = (this.write+1) & this.mask;
    }
    return true;
  }
}

registerProcessor('orbit-pitch-shift',OrbitPitchShiftProcessor);
