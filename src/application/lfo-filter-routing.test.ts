import { describe, expect, it, vi } from 'vitest';
import { DroneController } from './drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillators, validateLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneVoice, DroneVoiceFactory } from './audio-contracts';
import type { AudioGraph } from './audio-graph-contracts';
import type { ModulationMatrix, ModulationSourceFactory } from './modulation-contracts';

describe('LFO destination routing', () => {
  it('connects both filter stages and reconnects to pitch on target change', async () => {
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
    const original = controller.lowFrequencyOscillatorSettings[0];
    controller.updateLowFrequencyOscillator({...original, enabled: true, destination: 'filterCutoff'});
    expect(matrix.connect).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: cutoffA}));
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: cutoffB}));
    controller.updateLowFrequencyOscillator({...original, enabled: true, destination: 'pitch'});
    expect(matrix.disconnect).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({parameter: pitch}));
    controller.stop();
  });
  it('rejects invalid destinations and depth', () => {
    const original = createDefaultLowFrequencyOscillators(['oscillator-1'])[0];
    expect(() => validateLowFrequencyOscillatorSettings({...original, depthHz: -1})).toThrow();
    expect(() => validateLowFrequencyOscillatorSettings({...original, destination: 'unknown' as typeof original.destination})).toThrow();
  });
});
