import { describe, expect, it } from 'vitest';
import { OscillatorStepPlayer } from './oscillator-step-player';
import type { StepPlaybackMode, StepPlayhead } from './oscillator-step-player';
import { applyStepValues, readStepValue } from '@domain/oscillator-step-sequence';
import type { OscillatorStep, StepTarget } from '@domain/oscillator-step-sequence';
import { createDefaultDroneLayer } from '@domain/drone-layers';
import { loadBuiltInOscillatorBank } from '@domain/built-in-oscillator-banks';

function setup(mode: StepPlaybackMode, first: OscillatorStep, second: OscillatorStep) {
  let drone = loadBuiltInOscillatorBank('breathing-reed', createDefaultDroneLayer('A')).drone;
  let playhead: StepPlayhead | null = null;
  const player = new OscillatorStepPlayer(mode, [{index: 0, step: first}, {index: 2, step: second}], {
    readDrone: () => drone,
    applyValues: values => { drone = applyStepValues(drone, values); },
    onPlayhead: next => { playhead = next; }
  });
  return {player, read: (target: StepTarget) => readStepValue(drone, target), playhead: () => playhead};
}

const [firstOscillator, , thirdOscillator] = createDefaultDroneLayer('A').drone.oscillators;
const volume = {oscillatorId: firstOscillator.id, parameter: 'volume'} as const;
const cutoff = {oscillatorId: thirdOscillator.id, parameter: 'cutoff'} as const;
const first = {values: [{...volume, value: 0}, {...cutoff, value: 860}], glideSeconds: 2, holdSeconds: 3};
const second = {values: [{...volume, value: 0.6}], glideSeconds: 2, holdSeconds: 0};

describe('oscillator step playback', () => {
  it('glides captured values, holds them, and keeps the last sound at the end', () => {
    const {player, read, playhead} = setup('once', first, second);
    expect(player.start(10)).toBe(true);
    player.tick(11);
    expect(read(volume)).toBeCloseTo(0.23);
    expect(read(cutoff)).toBeCloseTo(660);
    player.tick(12);
    expect(playhead()).toEqual({index: 0, phase: 'hold'});
    expect(read(volume)).toBe(0);
    player.tick(15);
    expect(playhead()).toEqual({index: 2, phase: 'glide'});
    player.tick(16);
    expect(read(volume)).toBe(0.3);
    expect(read(cutoff)).toBe(860);
    expect(player.tick(17)).toBe(false);
    expect(read(volume)).toBe(0.6);
    expect(playhead()).toBeNull();
  });

  it('loops back from the last step without resetting current values', () => {
    const {player, read, playhead} = setup('loop', first, second);
    player.start(0);
    player.tick(5);
    player.tick(7);
    expect(playhead()).toEqual({index: 0, phase: 'glide'});
    player.tick(8);
    expect(read(volume)).toBe(0.3);
  });

  it('waits in manual mode and can advance from a partially completed glide', () => {
    const {player, read, playhead} = setup('manual', first, second);
    player.start(0);
    player.tick(1);
    player.advance(1);
    player.tick(2);
    expect(read(volume)).toBe(0.415);
    expect(read(cutoff)).toBe(660);
    expect(player.tick(75)).toBe(true);
    expect(playhead()).toEqual({index: 2, phase: 'waiting'});
    expect(player.canAdvance).toBe(false);
  });

  it('can change enabled waveform FM depth independently of oscillator settings', () => {
    const {drone} = loadBuiltInOscillatorBank('glass-bell', createDefaultDroneLayer('A'));
    const target = {oscillatorId: thirdOscillator.id, parameter: 'frequencyDepth'} as const;
    expect(readStepValue(drone, target)).toBe(160);
    const next = applyStepValues(drone, [{...target, value: 0}]);
    expect(next.oscillators).toBe(drone.oscillators);
    expect(next.oscillatorModulations).toEqual([{...drone.oscillatorModulations?.[0], depth: 0}]);
    expect(() => applyStepValues({...next, oscillatorModulations: []}, [{...target, value: 100}])).toThrow();
  });
});
