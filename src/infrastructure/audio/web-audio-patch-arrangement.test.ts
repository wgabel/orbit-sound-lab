import { describe, expect, it, vi } from 'vitest';
import { getClipEnvelope, scheduleClipGates } from './web-audio-patch-arrangement';

describe('arrangement audio scheduling', () => {
  const clip = {id:'clip',moduleId:'wave',start:4,duration:8,fadeIn:2,fadeOut:2,level:0.8};

  it('starts a sought clip at the correct point within a fade and schedules its remaining envelope', () => {
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    scheduleClipGates({setValueAtTime,linearRampToValueAtTime},[clip],10,15);
    expect(setValueAtTime.mock.calls).toEqual([[0,15],[0.4,15]]);
    expect(linearRampToValueAtTime.mock.calls).toEqual([[0.8,16],[0.8,20],[0,22]]);
  });

  it('ramps both edges of a clip even when the requested fades are zero', () => {
    const envelope = getClipEnvelope({...clip,start:0,duration:0.05,fadeIn:0,fadeOut:0});
    expect(envelope).toEqual([[0,0],[0.02,0.8],[expect.closeTo(0.03),0.8],[0.05,0]]);
  });

  it('holds silence between a completed clip and a future clip', () => {
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    scheduleClipGates({setValueAtTime,linearRampToValueAtTime},[clip,{...clip,start:15}],10,23);
    expect(setValueAtTime.mock.calls).toEqual([[0,23],[0,25]]);
    expect(linearRampToValueAtTime.mock.calls).toEqual([[0.8,27],[0.8,31],[0,33]]);
  });
});
