import { getShelfFrequencyHz } from '@domain/drone-shelf-response';
import type { PatchRuntimeFactory } from './contracts';
import { WebAudioPitchShift } from '@infrastructure/audio/web-audio-pitch-shift';
import { WebAudioReverb } from '@infrastructure/audio/web-audio-reverb';
import { WebAudioShelfEq } from '@infrastructure/audio/web-audio-shelf-eq';

export const createPitchShiftRuntime: PatchRuntimeFactory<'pitchShift'> = (
  definition,{context,options}
) => {
  const {semitones,cents} = definition.settings;
  if (options.pitchWorklet) {
    const effect = options.pitchWorklet.create(semitones,cents);
    return {definition,inputs:{in:effect.input},output:effect.output,
      parameters:{semitones:{parameter:effect.pitch,base:semitones}},dispose:effect.dispose};
  }
  const effect = new WebAudioPitchShift(context,semitones,cents);
  return {definition,inputs:{in:effect.input},output:effect.output,dispose:() => effect.dispose()};
};

export const createFilterRuntime: PatchRuntimeFactory<'filter'> = (definition,{context}) => {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = definition.settings.cutoff;
  filter.Q.value = definition.settings.resonance;
  return {definition,inputs:{in:filter},output:filter,parameters:{
    cutoff:{parameter:filter.frequency,base:definition.settings.cutoff},
    resonance:{parameter:filter.Q,base:definition.settings.resonance}
  },dispose:() => filter.disconnect()};
};

export const createReverbRuntime: PatchRuntimeFactory<'reverb'> = (definition,{context}) => {
  const effect = new WebAudioReverb(context,{...definition.settings,enabled:true});
  const mix = effect.enableMixAutomation(definition.settings.mix);
  return {definition,inputs:{in:effect.input},output:effect.output,
    parameters:{mix:{parameter:mix,base:definition.settings.mix}},dispose:() => effect.dispose()};
};

export const createShelfEqRuntime: PatchRuntimeFactory<'shelfEq'> = (definition,{context}) => {
  const shelf = new WebAudioShelfEq(context,definition.settings);
  const {lowShelf,highShelf} = shelf;
  const constrain = (value: number) => getShelfFrequencyHz(value,context.sampleRate);
  return {definition,inputs:{in:lowShelf},output:highShelf,parameters:{
    lowFrequency:{parameter:lowShelf.frequency,base:lowShelf.frequency.value,constrain},
    lowGain:{parameter:lowShelf.gain,base:lowShelf.gain.value},
    highFrequency:{parameter:highShelf.frequency,base:highShelf.frequency.value,constrain},
    highGain:{parameter:highShelf.gain,base:highShelf.gain.value}
  },dispose:() => shelf.dispose()};
};

export const createOscilloscopeRuntime: PatchRuntimeFactory<'oscilloscope'> = (
  definition,{context}
) => {
  const signal = context.createGain();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  signal.connect(analyser);
  return {definition,inputs:{in:signal},output:signal,waveformAnalyser:analyser,
    dispose() {signal.disconnect();analyser.disconnect();}};
};
