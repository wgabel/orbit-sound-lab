import type { PatchPlayback } from '../application/patch-playback';
import { WebAudioPatchPlayback } from '../infrastructure/audio/web-audio-patch-playback';

export function createPatchPlayback(): PatchPlayback {
  // Match the Drone Editor's buffering so layered patches have more time to render audio.
  return new WebAudioPatchPlayback(new AudioContext({latencyHint:'playback'}));
}
