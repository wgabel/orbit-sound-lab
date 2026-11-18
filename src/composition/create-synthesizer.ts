import type { SoundLabController } from '../application/audio-contracts';
import { WebAudioLfoWorkletFactory } from '../infrastructure/audio/web-audio-lfo-worklet';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
import { WebAudioOutputProtection } from '../infrastructure/audio/web-audio-output-protection';
import { WebAudioScenePlayback } from '../infrastructure/audio/web-audio-scene-playback';
import { createSoundLabVoice } from './create-sound-lab-voice';

export function createSynthesizer(): SoundLabController {
  const context = new AudioContext({latencyHint: 'playback'});
  const lfoWorklet = new WebAudioLfoWorkletFactory(context);
  const modulationFactory = new WebAudioLowFrequencyOscillatorFactory(context, lfoWorklet);
  const outputProtection = new WebAudioOutputProtection(context);
  const editorLevel = context.createGain();
  const voice = createSoundLabVoice(context, editorLevel, lfoWorklet, modulationFactory);
  editorLevel.connect(outputProtection.input);
  outputProtection.output.connect(context.destination);
  const scenePlayback = new WebAudioScenePlayback(context, outputProtection.input, editorLevel.gain,
    (scene, output) => createSoundLabVoice(context, output, lfoWorklet, modulationFactory, scene));

  return {
    ...voice,
    get isPlaying() { return voice.isPlaying; },
    get delaySettings() { return voice.delaySettings; },
    scenePlayback,
    dispose() {
      scenePlayback.dispose();
      voice.dispose();
      editorLevel.disconnect();
      outputProtection.dispose();
      void context.close();
    }
  };
}
