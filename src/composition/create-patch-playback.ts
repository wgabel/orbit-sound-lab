import type { PatchPlayback } from '../application/patch-playback';
import { WebAudioPatchPlayback } from '../infrastructure/audio/web-audio-patch-playback';

export function createPatchPlayback(): PatchPlayback {
  return new WebAudioPatchPlayback(new AudioContext({latencyHint:'interactive'}));
}
