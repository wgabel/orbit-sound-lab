import type { ScenePlayback } from '../../application/audio-contracts';
import {
  ARRANGEMENT_FADE_IN_SECONDS, ARRANGEMENT_FADE_OUT_SECONDS, ARRANGEMENT_TAIL_SECONDS,
  sceneBlendGains, validateArrangement
} from '../../domain/sound-scene';
import type { ArrangementScene, SoundScene } from '../../domain/sound-scene';
import { fadeGain, PLAYBACK_FADE_SECONDS } from './web-audio-fade';

interface SceneVoice {
  start(): Promise<void>;
  fadeSources(start: number, end: number): void;
  dispose(): void;
}

interface Track {
  readonly voice: SceneVoice;
  readonly level: GainNode;
}

interface Session {
  readonly output: GainNode;
  readonly abort: AbortController;
  readonly tracks: Set<Track>;
  disposalTimer?: ReturnType<typeof setTimeout>;
}

interface Morph {
  position: number;
  tracks?: readonly [Track, Track];
}

export class WebAudioScenePlayback implements ScenePlayback {
  private session: Session | null = null;
  private morph: Morph | null = null;
  private readonly sessions = new Set<Session>();

  constructor(private readonly context: AudioContext, private readonly destination: AudioNode,
    private readonly editorLevel: AudioParam,
    private readonly createVoice: (scene: SoundScene, output: AudioNode) => SceneVoice) {}

  async startMorph(start: SoundScene, end: SoundScene, position: number): Promise<void> {
    sceneBlendGains(position);
    const session = this.beginSession();
    const morph: Morph = {position};
    this.morph = morph;
    try {
      const tracks = await Promise.all([this.prepareTrack(session, start), this.prepareTrack(session, end)] as const);
      if (session.abort.signal.aborted) return;
      morph.tracks = tracks;
      this.setMorphPosition(morph.position);
      this.revealSession(session);
    } catch (error) {
      if (session.abort.signal.aborted) return;
      this.stop();
      throw error;
    }
  }

  setMorphPosition(position: number): void {
    const gains = sceneBlendGains(position);
    if (!this.morph) return;
    this.morph.position = position;
    this.morph.tracks?.forEach((track, index) =>
      fadeGain(track.level.gain, gains[index], this.context.currentTime));
  }

  async playArrangement(scenes: readonly ArrangementScene[], onScene: (index: number) => void): Promise<void> {
    validateArrangement(scenes);
    const session = this.beginSession();
    const {signal} = session.abort;
    try {
      let current = await this.prepareTrack(session, scenes[0].sound);
      if (signal.aborted) return;
      this.revealSession(session);
      onScene(0);
      let now = this.context.currentTime;
      let reachedScene = now + ARRANGEMENT_FADE_IN_SECONDS;
      current.level.gain.setValueAtTime(0, now);
      current.level.gain.linearRampToValueAtTime(1, reachedScene);

      for (let index = 1; index < scenes.length; index++) {
        const previousScene = scenes[index - 1];
        const incoming = await this.prepareTrack(session, scenes[index].sound);
        if (signal.aborted) return;
        now = this.context.currentTime;
        const blendStart = Math.max(now, reachedScene + previousScene.holdSeconds);
        reachedScene = blendStart + Math.max(PLAYBACK_FADE_SECONDS, previousScene.blendSeconds);
        current.level.gain.setValueAtTime(1, blendStart);
        current.level.gain.linearRampToValueAtTime(0, reachedScene);
        incoming.level.gain.setValueAtTime(0, blendStart);
        incoming.level.gain.linearRampToValueAtTime(1, reachedScene);
        if (!await this.waitUntil(blendStart, signal)) return;
        onScene(index);
        if (!await this.waitUntil(reachedScene, signal)) return;
        this.disposeTrack(session, current);
        current = incoming;
      }

      const fadeStart = Math.max(this.context.currentTime, reachedScene + scenes[scenes.length - 1].holdSeconds);
      const fadeEnd = fadeStart + ARRANGEMENT_FADE_OUT_SECONDS;
      const tailEnd = fadeEnd + ARRANGEMENT_TAIL_SECONDS;
      current.voice.fadeSources(fadeStart, fadeEnd);
      current.level.gain.setValueAtTime(1, tailEnd - PLAYBACK_FADE_SECONDS);
      current.level.gain.linearRampToValueAtTime(0, tailEnd);
      await this.waitUntil(tailEnd, signal);
    } catch (error) {
      if (!signal.aborted) throw error;
    } finally {
      if (this.session === session) this.stop();
    }
  }

  stop(): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    this.morph = null;
    session.abort.abort();
    const now = this.context.currentTime;
    fadeGain(session.output.gain, 0, now);
    fadeGain(this.editorLevel, 1, now);
    session.disposalTimer = setTimeout(() => this.disposeSession(session), 2_000 * PLAYBACK_FADE_SECONDS);
  }

  dispose(): void {
    this.session = null;
    this.morph = null;
    for (const session of this.sessions) this.disposeSession(session);
  }

  private beginSession(): Session {
    this.stop();
    const output = this.context.createGain();
    output.gain.value = 0;
    output.connect(this.destination);
    const session: Session = {output, abort: new AbortController(), tracks: new Set()};
    this.sessions.add(session);
    this.session = session;
    return session;
  }

  private revealSession(session: Session): void {
    const now = this.context.currentTime;
    fadeGain(session.output.gain, 1, now);
    fadeGain(this.editorLevel, 0, now);
  }

  private async prepareTrack(session: Session, scene: SoundScene): Promise<Track> {
    const level = this.context.createGain();
    level.gain.value = 0;
    const track: Track = {level, voice: this.createVoice(scene, level)};
    session.tracks.add(track);
    level.connect(session.output);
    await track.voice.start();
    return track;
  }

  private disposeSession(session: Session): void {
    clearTimeout(session.disposalTimer);
    session.abort.abort();
    for (const track of session.tracks) this.disposeTrack(session, track);
    session.output.disconnect();
    this.sessions.delete(session);
  }

  private disposeTrack(session: Session, track: Track): void {
    if (!session.tracks.delete(track)) return;
    track.voice.dispose();
    track.level.disconnect();
  }

  private waitUntil(time: number, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted || this.context.currentTime >= time) return Promise.resolve(!signal.aborted);
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve(!signal.aborted);
      };
      const check = () => {
        const remaining = time - this.context.currentTime;
        if (remaining <= 0) finish();
        else timer = setTimeout(check, Math.max(10, Math.min(500, remaining * 1_000)));
      };
      signal.addEventListener('abort', finish, {once: true});
      check();
    });
  }
}
