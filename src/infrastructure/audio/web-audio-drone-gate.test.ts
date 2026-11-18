import { expect, it, vi } from 'vitest';
import { WebAudioDroneGate } from './web-audio-drone-gate';

it('releases from the current attack level and retriggers from the current release level', () => {
  const parameter = {
    setValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  };
  const context = {currentTime: 0, createGain: () => ({gain: parameter})};
  const gate = new WebAudioDroneGate(context as unknown as BaseAudioContext);
  gate.setEnvelope({attack: 1, decay: 1, sustain: 0.75, release: 1});
  gate.reset(false);
  gate.trigger();
  expect(parameter.linearRampToValueAtTime.mock.calls).toEqual([[1, 1], [0.75, 2]]);

  context.currentTime = 0.5;
  gate.release();
  expect(parameter.cancelScheduledValues).toHaveBeenLastCalledWith(0.5);
  expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(0.5, 0.5);
  expect(parameter.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.5);

  context.currentTime = 1;
  gate.trigger();
  expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(0.25, 1);
  expect(parameter.linearRampToValueAtTime.mock.calls.slice(-2)).toEqual([[1, 2], [0.75, 3]]);
});
