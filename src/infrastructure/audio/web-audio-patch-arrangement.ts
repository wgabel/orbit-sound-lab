import type { ArrangementClip } from '../../domain/patch-arrangement';
import { PLAYBACK_FADE_SECONDS } from './web-audio-fade';

export function getClipEnvelope(clip: ArrangementClip): readonly [time: number, value: number][] {
  const incoming = Math.max(PLAYBACK_FADE_SECONDS,clip.fadeIn);
  const outgoing = Math.max(PLAYBACK_FADE_SECONDS,clip.fadeOut);
  const scale = Math.min(1,clip.duration/(incoming+outgoing));
  const end = clip.start + clip.duration;
  const peak = clip.start + incoming*scale;
  return [[clip.start,0],[peak,clip.level],[Math.max(peak,end-outgoing*scale),clip.level],[end,0]];
}

export function scheduleClipGates(gain: Pick<AudioParam, 'setValueAtTime' | 'linearRampToValueAtTime'>,
  clips: readonly ArrangementClip[], origin: number, now: number, complement = false): void {
  const time = now - origin;
  const weight = (value: number) => complement ? 1-value : value;
  gain.setValueAtTime(weight(0),now);
  for (const clip of clips) {
    if (clip.start + clip.duration <= time) continue;
    const envelope = getClipEnvelope(clip);
    if (clip.start > time) gain.setValueAtTime(weight(0),origin+clip.start);
    for (let index = 1; index < envelope.length; index++) {
      const [next,value] = envelope[index];
      if (next <= time) continue;
      const [previous,previousValue] = envelope[index-1];
      if (previous <= time) gain.setValueAtTime(weight(previousValue+(value-previousValue)*(time-previous)/(next-previous)),now);
      gain.linearRampToValueAtTime(weight(value),origin+next);
    }
  }
}
