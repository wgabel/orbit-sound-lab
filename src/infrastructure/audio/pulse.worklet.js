function smoothDiscontinuity(phase, increment) {
  if (phase < increment) {
    const position = phase / increment;
    return -((1 - position) ** 2);
  }
  if (phase > 1 - increment) {
    const position = (phase - 1) / increment;
    return (1 + position) ** 2;
  }
  return 0;
}

class OrbitPulseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {name: 'frequency', defaultValue: 0},
      {name: 'detune', defaultValue: 0},
      {name: 'shape', defaultValue: 0},
      {name: 'gate', defaultValue: 0}
    ];
  }

  constructor({processorOptions: {minimumWidth, maximumWidth}}) {
    super();
    this.minimumWidth = minimumWidth;
    this.maximumWidth = maximumWidth;
    this.phase = 0;
    this.width = 0.5;
    this.widthSmoothing = 1 - Math.exp(-1 / (0.002 * sampleRate));
    this.active = false;
    this.stopped = false;
    this.port.onmessage = () => { this.stopped = true; };
  }

  process(_inputs, [[output]], {frequency, detune, shape, gate}) {
    if (this.stopped) return false;
    if (!output) return true;
    for (let index = 0; index < output.length; index++) {
      if (!(gate.length === 1 ? gate[0] : gate[index])) {
        output[index] = 0;
        continue;
      }
      const pitch = frequency.length === 1 ? frequency[0] : frequency[index];
      const cents = detune.length === 1 ? detune[0] : detune[index];
      const increment = pitch * 2 ** (cents / 1200) / sampleRate;
      if (!(increment > 0 && increment < 0.5)) {
        output[index] = 0;
        continue;
      }
      const requestedWidth = shape.length === 1 ? shape[0] : shape[index];
      const targetWidth = Math.max(this.minimumWidth, Math.min(this.maximumWidth, requestedWidth));
      this.width = this.active ? this.width + (targetWidth - this.width) * this.widthSmoothing : targetWidth;
      this.active = true;
      const {phase, width} = this;
      const fallingEdgePhase = (phase - width + 1) % 1;
      // Smooth both pulse edges with PolyBLEP. Subtract the mean before
      // normalizing so narrow pulses stay centered and within the usual range.
      const pulse = Number(phase < width) +
        (smoothDiscontinuity(phase, increment) - smoothDiscontinuity(fallingEdgePhase, increment)) / 2;
      output[index] = (pulse - width) / Math.max(width, 1 - width);
      this.phase = (phase + increment) % 1;
    }
    return true;
  }
}

registerProcessor('orbit-pulse', OrbitPulseProcessor);
