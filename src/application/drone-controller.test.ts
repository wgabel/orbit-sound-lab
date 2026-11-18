import { describe, expect, it, vi } from 'vitest';
import { DroneController } from './drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { createDefaultLowFrequencyOscillators } from '../domain/modulation';
import type { DroneVoice, DroneVoiceFactory } from './audio-contracts';
import type { AudioGraph } from './audio-graph-contracts';
import type { ModulationMatrix, ModulationSourceFactory } from './modulation-contracts';

function createHarness() {
  const settings = createDefaultDroneSettings();
  const parameters = new Map(settings.oscillators.map(item => [item.id, {} as AudioParam]));
  const voice = {output: {} as AudioNode, start: vi.fn(), dispose: vi.fn(), getDetuneParameter: vi.fn((id: string) => parameters.get(id)!), getAmplitudeParameter: vi.fn((id: string) => parameters.get(id)!), getFilterCutoffParameters: vi.fn((id: string) => [parameters.get(id)!, {} as AudioParam])} as unknown as DroneVoice;
  const factory = {create: vi.fn(() => voice)} as DroneVoiceFactory;
  const graph = {register: vi.fn(), connect: vi.fn(), unregister: vi.fn(), dispose: vi.fn()} as unknown as AudioGraph;
  const matrix = {connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn()} as unknown as ModulationMatrix;
  const sources = Array.from({length: 5}, () => ({output: {} as AudioNode, start: vi.fn(), update: vi.fn(), dispose: vi.fn()}));
  const modulationFactory = {create: vi.fn().mockImplementation(() => sources.shift()!)} as unknown as ModulationSourceFactory;
  const context = {resume: vi.fn().mockResolvedValue(undefined)} as unknown as AudioContext;
  const controller = new DroneController(context, factory, graph, matrix, modulationFactory, settings, createDefaultLowFrequencyOscillators(settings.oscillators.map(item => item.id)));
  return {controller, matrix, modulationFactory};
}

describe('independent oscillator LFOs', () => {
  it('does not create disabled LFOs and connects two enabled targets independently', async () => {
    const {controller, matrix, modulationFactory} = createHarness();
    await controller.start();
    expect(modulationFactory.create).not.toHaveBeenCalled();
    const [first, , , second] = controller.lowFrequencyOscillatorSettings;
    controller.updateLowFrequencyOscillator({...first, enabled: true});
    controller.updateLowFrequencyOscillator({...second, enabled: true, frequencyHz: 0.35});
    expect(modulationFactory.create).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({id: first.targetOscillatorId}));
    expect(matrix.connect).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({id: second.targetOscillatorId}));
    controller.updateLowFrequencyOscillator({...first, enabled: false});
    expect(matrix.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.lowFrequencyOscillatorSettings.find(item => item.targetOscillatorId === second.targetOscillatorId)?.enabled).toBe(true);
    controller.stop();
    expect(matrix.disconnect).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown targets without changing existing settings', () => {
    const {controller} = createHarness();
    expect(() => controller.updateLowFrequencyOscillator({...controller.lowFrequencyOscillatorSettings[0], targetOscillatorId: 'missing'})).toThrow('Unknown LFO target');
    expect(controller.lowFrequencyOscillatorSettings).toHaveLength(15);
  });

  it('starts each pre-enabled LFO and disposes them on stop', async () => {
    const {controller, modulationFactory, matrix} = createHarness();
    const [first, , , second] = controller.lowFrequencyOscillatorSettings;
    controller.updateLowFrequencyOscillator({...first, enabled: true});
    controller.updateLowFrequencyOscillator({...second, enabled: true});
    await controller.start();
    expect(modulationFactory.create).toHaveBeenCalledTimes(2);
    controller.stop();
    expect(matrix.disconnect).toHaveBeenCalledTimes(2);
  });
});
