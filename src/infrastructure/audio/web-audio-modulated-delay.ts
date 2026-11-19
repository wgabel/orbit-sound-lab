import { DRONE_EFFECT_RANGES } from '../../domain/drone-effects';
import type { ChorusSettings, FlangerSettings } from '../../domain/drone-effects';
import type { EffectProcessor } from './web-audio-effect-stage';

const MODULATION_SMOOTHING_SECONDS = 0.02;
const MAXIMUM_DELAY_SECONDS = 0.1;

function createDelayPath(context: BaseAudioContext, oscillator: OscillatorNode, center: number, depth: number) {
  const delay = context.createDelay(MAXIMUM_DELAY_SECONDS);
  delay.delayTime.value = center;
  const modulation = context.createGain();
  modulation.gain.value = depth;
  oscillator.connect(modulation);
  modulation.connect(delay.delayTime);
  return {delay,modulation};
}

export function createStereoChorus(context: BaseAudioContext, initial: ChorusSettings): EffectProcessor<ChorusSettings> {
  const input = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  const splitter = context.createChannelSplitter(2);
  const output = context.createChannelMerger(2);
  const oscillator = context.createOscillator();
  oscillator.frequency.value = initial.rateHz;
  input.connect(splitter);
  const paths = [1,-1].map((direction,channel) => {
    const path = createDelayPath(context,oscillator,0.022 + channel * 0.005,direction * initial.depthMilliseconds / 1000);
    splitter.connect(path.delay,channel);
    path.delay.connect(output,0,channel);
    return {...path,direction};
  });
  oscillator.start();
  return {input,output,
    update(settings,now) {
      oscillator.frequency.setTargetAtTime(settings.rateHz,now,MODULATION_SMOOTHING_SECONDS);
      for (const {modulation,direction} of paths) {
        modulation.gain.setTargetAtTime(direction * settings.depthMilliseconds / 1000,now,MODULATION_SMOOTHING_SECONDS);
      }
    },
    dispose() {
      oscillator.stop();
      oscillator.disconnect();
      input.disconnect();
      splitter.disconnect();
      for (const {delay,modulation} of paths) {
        delay.disconnect();
        modulation.disconnect();
      }
      output.disconnect();
    }
  };
}

export function createFlanger(context: BaseAudioContext, initial: FlangerSettings): EffectProcessor<FlangerSettings> {
  const oscillator = context.createOscillator();
  oscillator.frequency.value = initial.rateHz;
  // A DelayNode inside a feedback cycle has a minimum of one 128-frame render quantum.
  const center = Math.max(0.0065,128 / context.sampleRate + DRONE_EFFECT_RANGES.flangerDepth.max / 1000);
  const {delay,modulation} = createDelayPath(context,oscillator,center,initial.depthMilliseconds / 1000);
  const feedback = context.createGain();
  feedback.gain.value = initial.feedback;
  delay.connect(feedback).connect(delay);
  oscillator.start();
  return {input:delay,output:delay,
    update(settings,now) {
      oscillator.frequency.setTargetAtTime(settings.rateHz,now,MODULATION_SMOOTHING_SECONDS);
      modulation.gain.setTargetAtTime(settings.depthMilliseconds / 1000,now,MODULATION_SMOOTHING_SECONDS);
      feedback.gain.setTargetAtTime(settings.feedback,now,MODULATION_SMOOTHING_SECONDS);
    },
    dispose() {
      oscillator.stop();
      oscillator.disconnect();
      modulation.disconnect();
      delay.disconnect();
      feedback.disconnect();
    }
  };
}
