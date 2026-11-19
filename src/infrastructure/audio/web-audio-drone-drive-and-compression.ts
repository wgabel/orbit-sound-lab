import type { CompressorSettings, OverdriveSettings } from '../../domain/drone-effects';
import type { EffectProcessor } from './web-audio-effect-stage';

const SMOOTHING_SECONDS = 0.02;
const DRIVE_CURVE_LENGTH = 2049;
const DRIVE_CURVE = Float32Array.from({length:DRIVE_CURVE_LENGTH}, (_, index) =>
  Math.tanh(2 * index / (DRIVE_CURVE_LENGTH - 1) - 1));
const COMPENSATION_REFERENCE_AMPLITUDE = 0.15;

function writeParameter(parameter: AudioParam, value: number, now?: number): void {
  if (now === undefined) parameter.value = value;
  else parameter.setTargetAtTime(value,now,SMOOTHING_SECONDS);
}

export function createOverdrive(context: BaseAudioContext, initial: OverdriveSettings): EffectProcessor<OverdriveSettings> {
  const input = context.createGain();
  const shaper = context.createWaveShaper();
  const tone = context.createBiquadFilter();
  const output = context.createGain();
  shaper.curve = DRIVE_CURVE;
  shaper.oversample = '4x';
  tone.type = 'lowpass';
  tone.Q.value = 20 * Math.log10(Math.SQRT1_2);
  input.connect(shaper).connect(tone).connect(output);
  function update(settings: OverdriveSettings, now?: number) {
    const drive = 10 ** (settings.driveDecibels / 20);
    // Keep a moderate input level roughly stable while increasing drive.
    const gain = COMPENSATION_REFERENCE_AMPLITUDE / Math.tanh(COMPENSATION_REFERENCE_AMPLITUDE * drive);
    writeParameter(input.gain,drive,now);
    writeParameter(tone.frequency,Math.min(settings.toneHz,context.sampleRate * 0.49),now);
    writeParameter(output.gain,gain,now);
  }
  update(initial);
  return {input,output,update,dispose() {
    input.disconnect();
    shaper.disconnect();
    tone.disconnect();
    output.disconnect();
  }};
}

export function createCompressor(context: BaseAudioContext, initial: CompressorSettings): EffectProcessor<CompressorSettings> {
  const compressor = context.createDynamicsCompressor();
  compressor.knee.value = 12;
  function update(settings: CompressorSettings, now?: number) {
    writeParameter(compressor.threshold,settings.thresholdDecibels,now);
    writeParameter(compressor.ratio,settings.ratio,now);
    writeParameter(compressor.attack,settings.attackMilliseconds / 1000,now);
    writeParameter(compressor.release,settings.releaseMilliseconds / 1000,now);
  }
  update(initial);
  return {input:compressor,output:compressor,update,dispose() { compressor.disconnect(); }};
}
