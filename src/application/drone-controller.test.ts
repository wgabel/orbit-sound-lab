import { describe, expect, it, vi } from 'vitest';
import { DroneController } from './drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneVoice, DroneVoiceFactory } from './audio-contracts';
import type { AudioGraph } from './audio-graph-contracts';
import type { ModulationMatrix, ModulationSourceFactory } from './modulation-contracts';

describe('DroneController modulation lifecycle', () => {
  it('does not create an LFO when disabled, but creates one when enabled during playback', async () => {
    const voice = {output: {} as AudioNode, start: vi.fn(), dispose: vi.fn(), getDetuneParameter: vi.fn(() => ({} as AudioParam))} as unknown as DroneVoice;
    const factory = {create: vi.fn(() => voice)} as DroneVoiceFactory;
    const graph = {register: vi.fn(), connect: vi.fn(), unregister: vi.fn(), dispose: vi.fn()} as unknown as AudioGraph;
    const matrix = {connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn()} as unknown as ModulationMatrix;
    const source = {output: {} as AudioNode, start: vi.fn(), update: vi.fn(), dispose: vi.fn()};
    const modulationFactory = {create: vi.fn(() => source)} as unknown as ModulationSourceFactory;
    const context = {resume: vi.fn().mockResolvedValue(undefined)} as unknown as AudioContext;
    const controller = new DroneController(context, factory, graph, matrix, modulationFactory, createDefaultDroneSettings(), createDefaultLowFrequencyOscillatorSettings());
    await controller.start();
    expect(modulationFactory.create).not.toHaveBeenCalled();
    controller.updateLowFrequencyOscillator({...controller.lowFrequencyOscillatorSettings, enabled: true});
    expect(modulationFactory.create).toHaveBeenCalledTimes(1);
    controller.updateLowFrequencyOscillator({...controller.lowFrequencyOscillatorSettings, enabled: false});
    expect(source.dispose).toHaveBeenCalledTimes(1);
    controller.stop();
    expect(source.dispose).toHaveBeenCalledTimes(1);
  });
});
