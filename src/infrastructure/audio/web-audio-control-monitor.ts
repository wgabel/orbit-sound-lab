/** Samples the normalized signal after shaping and before any cable mapping. */
export function createControlMonitor(context: BaseAudioContext, output: AudioNode) {
  const analyser = context.createAnalyser();
  analyser.fftSize = 32;
  const samples = new Float32Array(analyser.fftSize);
  output.connect(analyser);

  return {
    read() {
      analyser.getFloatTimeDomainData(samples);
      return Math.min(1,Math.max(0,samples[samples.length - 1]));
    }
  };
}
