import { describe, expect, it, vi } from 'vitest';
import { DroneController } from './drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneVoice, DroneVoiceFactory } from './audio-contracts';
import type { AudioGraph } from './audio-graph-contracts';
import type { ModulationMatrix, ModulationSourceFactory } from './modulation-contracts';

describe('LFO destination routing', () => {
  it('connects filter stages and pitch simultaneously without disconnecting either', async () => {
    const drone = createDefaultDroneSettings();
    const pitch = {} as AudioParam;
    const cutoffA = {} as AudioParam;
    const cutoffB = {} as AudioParam;
    const voice = {output: {} as AudioNode, start: vi.fn(), dispose: vi.fn(), getDetuneParameter: vi.fn(() => pitch), getFilterCutoffParameters: vi.fn(() => [cutoffA, cutoffB])} as unknown as DroneVoice;
    const graph = {register: vi.fn(), connect: vi.fn(), unregister: vi.fn(), dispose: vi.fn()} as unknown as AudioGraph;
    const matrix = {connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn()} as unknown as ModulationMatrix;
    const source = () => ({output: {} as AudioNode, start: vi.fn(), update: vi.fn(), dispose: vi.fn()});
    const factory = {create: vi.fn(() => source())} as unknown as ModulationSourceFactory;
    const controller = new DroneController({resume: vi.fn().mockResolvedValue(undefined)} as unknown as AudioContext, {create: vi.fn(() => voice)} as DroneVoiceFactory, graph, matrix, factory, drone, createDefaultLowFrequencyOscillators(drone.oscillators.map(item => item.id)));
    await controller.start();
    const filterModulation = controller.lowFrequencyOscillatorSettings.find(item => item.targetOscillatorId === drone.oscillators[0].id && item.destination === 'filterCutoff')!;
    const pitchModulation = controller.lowFrequencyOscillatorSettings.find(item => item.targetOscillatorId === drone.oscillators[0].id && item.destination === 'pitch')!;
    controller.updateLowFrequencyOscillator({...filterModulation, enabled: true});
    expect(matrix.connect).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: cutoffA}));
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: cutoffB}));
    controller.updateLowFrequencyOscillator({...pitchModulation, enabled: true});
    expect(matrix.disconnect).not.toHaveBeenCalled();
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: pitch}));
    expect(matrix.connect).toHaveBeenCalledTimes(3);
    controller.stop();
    expect(matrix.disconnect).toHaveBeenCalledTimes(3);
  });
  it('rejects invalid destinations and depth', () => {
    const original = createDefaultLowFrequencyOscillators(['oscillator-1'])[0];
    expect(() => validateLowFrequencyOscillatorSettings({...original, depthHz: -1})).toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...original, destination: 'unknown' as typeof original.destination})).toThrow();
  });
});
