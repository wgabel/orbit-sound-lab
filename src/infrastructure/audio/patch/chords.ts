import { getChordFrequencies } from '@domain/chord';
import type { ChordSettings } from '@domain/chord';
import { voiceProgressionStep } from '@domain/chord-progression';
import type { ChordProgression, ChordStep } from '@domain/chord-progression';
import { readClipElapsed } from '@domain/patch/arrangement';
import type { ArrangementClip } from '@domain/patch/arrangement';
import { scheduleClipGates } from '@infrastructure/audio/patch/arrangement';

export interface ChordRoute {
  readonly settings: ChordProgression;
  readonly clips?: readonly ArrangementClip[];
}

function connectChordVoice(context: AudioContext, settings: ChordSettings, output: AudioNode): () => void {
  const frequencies = getChordFrequencies(settings);
  const start = context.currentTime;
  const oscillators = frequencies.map((frequency,index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = 0;
    const pan = context.createStereoPanner();
    pan.pan.value = (index/(frequencies.length-1)-0.5)*0.65;
    oscillator.connect(gain).connect(pan).connect(output);
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime(0.75/frequencies.length,start+0.035);
    oscillator.start(start);
    return {oscillator,gain,pan};
  });
  return () => {
    for (const {oscillator,gain,pan} of oscillators) {
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
      pan.disconnect();
    }
  };
}

function createProgressionPattern(context: AudioContext, settings: ChordProgression) {
  const chords = new Map<string,ChordStep>();
  const keys = settings.steps.map(step => {
    const key = `${step.rootNote}:${step.chord}`;
    chords.set(key,step);
    return key;
  });
  const sampleRate = 8000;
  // Compress the gate pattern in buffer time. Playback rate sets how long each chord lasts.
  const framesPerStep = 1600;
  const patternFrames = keys.length*framesPerStep;
  const holdFrames = settings.mode === 'once' ? 128 : 0;
  const buffer = context.createBuffer(chords.size,patternFrames+holdFrames,sampleRate);
  const voices = [...chords.entries()].map(([key,step],channel) => {
    const samples = buffer.getChannelData(channel);
    keys.forEach((active,index) => {
      if (active === key) samples.fill(1,index*framesPerStep,(index+1)*framesPerStep);
    });
    if (holdFrames && keys.at(-1) === key) samples.fill(1,patternFrames);
    return step;
  });
  return {buffer,voices,patternDuration:patternFrames/sampleRate,rate:framesPerStep/(sampleRate*settings.stepSeconds)};
}

export function createPatchChordVoice(context: AudioContext, settings: ChordSettings, origin: number, route?: ChordRoute) {
  const output = context.createGain();
  output.gain.value = 0.16;
  const disposals: Array<() => void> = [];
  const progression = route && (route.clips === undefined || route.clips.length > 0) ? route : undefined;
  if (!progression || progression.clips) {
    const fallback = context.createGain();
    fallback.connect(output);
    if (progression?.clips) scheduleClipGates(fallback.gain,progression.clips,origin,context.currentTime,true);
    disposals.push(connectChordVoice(context,settings,fallback),() => fallback.disconnect());
  }

  if (progression) {
    const {buffer,voices,patternDuration,rate} = createProgressionPattern(context,progression.settings);
    const mix = context.createGain();
    const splitter = context.createChannelSplitter(voices.length);
    mix.connect(output);
    if (progression.clips) scheduleClipGates(mix.gain,progression.clips,origin,context.currentTime);
    voices.forEach((step,channel) => {
      const level = context.createGain();
      level.gain.value = 0;
      level.connect(mix);
      const transition = context.createBiquadFilter();
      transition.type = 'lowpass';
      transition.frequency.value = 65;
      transition.Q.value = -6;
      splitter.connect(transition,channel);
      transition.connect(level.gain);
      disposals.push(connectChordVoice(context,voiceProgressionStep(settings,step),level),
        () => {transition.disconnect(); level.disconnect();});
    });

    const once = progression.settings.mode === 'once';
    function schedule(start: number, elapsed: number, end?: number) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      if (once) source.loopStart = patternDuration;
      source.playbackRate.value = rate;
      const position = elapsed*rate;
      source.connect(splitter);
      source.start(start,once ? Math.min(patternDuration,position) : position%patternDuration);
      if (end !== undefined) source.stop(end);
      disposals.push(() => {source.stop(); source.disconnect();});
    }

    if (progression.clips) {
      for (const clip of progression.clips) {
        const start = Math.max(context.currentTime,origin+clip.start);
        const end = origin+clip.start+clip.duration;
        if (start < end) schedule(start,Math.max(0,readClipElapsed(clip,start-origin)),end);
      }
    } else {
      const now = context.currentTime;
      schedule(now,Math.max(0,now-origin));
    }
    disposals.push(() => {splitter.disconnect(); mix.disconnect();});
  }

  return {output,dispose() {for (const dispose of disposals) dispose(); output.disconnect();}};
}
