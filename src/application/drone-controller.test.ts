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
  const voice = {output: {} as AudioNode, start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined), dispose: vi.fn(), getDetuneParameter: vi.fn((id: string) => parameters.get(id)!), getAmplitudeParameter: vi.fn((id: string) => parameters.get(id)!), getShapeParameter: vi.fn((id: string) => parameters.get(id)!), getFilterCutoffParameters: vi.fn((id: string) => [parameters.get(id)!, {} as AudioParam])} as unknown as DroneVoice;
  const factory = {create: vi.fn(() => voice)} as DroneVoiceFactory;
  const graph = {register: vi.fn(), connect: vi.fn(), unregister: vi.fn(), dispose: vi.fn()} as unknown as AudioGraph;
  const matrix = {connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn()} as unknown as ModulationMatrix;
  const sources = Array.from({length: 5}, () => ({output: {} as AudioNode, start: vi.fn(), update: vi.fn(), dispose: vi.fn()}));
  const modulationFactory = {create: vi.fn().mockImplementation(() => sources.shift()!)} as unknown as ModulationSourceFactory;
  const context = {resume: vi.fn().mockResolvedValue(undefined)} as unknown as AudioContext;
  const controller = new DroneController(context, factory, graph, matrix, modulationFactory, settings, createDefaultLowFrequencyOscillators(settings.oscillators.map(item => item.id)));
  return {controller, matrix, modulationFactory, graph, voice, factory};
}

describe('independent oscillator LFOs', () => {
  it('does not create disabled LFOs and connects two enabled targets independently', async () => {
    const {controller, matrix, modulationFactory} = createHarness();
    await controller.start();
    expect(modulationFactory.create).not.toHaveBeenCalled();
    const [first, second] = controller.lowFrequencyOscillatorSettings.filter(item => item.destination === 'pitch');
    controller.updateLowFrequencyOscillator({...first, enabled: true});
    controller.updateLowFrequencyOscillator({...second, enabled: true, frequencyHz: 0.35});
    expect(modulationFactory.create).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenCalledTimes(2);
    expect(matrix.connect).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({id: first.targetOscillatorId}));
    expect(matrix.connect).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({id: second.targetOscillatorId}));
    controller.updateLowFrequencyOscillator({...first, enabled: false});
    expect(matrix.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.lowFrequencyOscillatorSettings.find(item => item.targetOscillatorId === second.targetOscillatorId)?.enabled).toBe(true);
    await controller.stop();
    expect(matrix.disconnect).toHaveBeenCalledTimes(2);
  });

  it('routes Shape LFO to its own parameter alongside pitch', async () => {
    const {controller, matrix, voice} = createHarness();
    const [pitch, , , shape] = controller.lowFrequencyOscillatorSettings;
    const shapeParameter = {} as AudioParam;
    vi.mocked(voice.getShapeParameter).mockReturnValue(shapeParameter);
    controller.updateLowFrequencyOscillator({...pitch, enabled: true});
    controller.updateLowFrequencyOscillator({...shape, enabled: true, depthShape: 0.2});
    await controller.start();
    expect(voice.getShapeParameter).toHaveBeenCalledWith(shape.targetOscillatorId);
    expect(matrix.connect).toHaveBeenCalledWith(expect.anything(), {id: 'oscillator-1-shape-0', parameter: shapeParameter});
    expect(matrix.connect).toHaveBeenCalledTimes(2);
    await controller.stop();
  });

  it('rejects unknown targets without changing existing settings', () => {
    const {controller} = createHarness();
    expect(() => controller.updateLowFrequencyOscillator({...controller.lowFrequencyOscillatorSettings[0], targetOscillatorId: 'missing'})).toThrow('Unknown LFO target');
    expect(controller.lowFrequencyOscillatorSettings).toHaveLength(20);
  });

  it('starts each pre-enabled LFO and disposes them on stop', async () => {
    const {controller, modulationFactory, matrix} = createHarness();
    const [first, second] = controller.lowFrequencyOscillatorSettings.filter(item => item.destination === 'pitch');
    controller.updateLowFrequencyOscillator({...first, enabled: true});
    controller.updateLowFrequencyOscillator({...second, enabled: true});
    await controller.start();
    expect(modulationFactory.create).toHaveBeenCalledTimes(2);
    await controller.stop();
    expect(matrix.disconnect).toHaveBeenCalledTimes(2);
  });
});

describe('drone playback transitions', () => {
  it('keeps the voice routed through its fade and waits before restarting', async () => {
    const {controller, graph, voice, factory} = createHarness();
    let finishFade = () => {};
    vi.mocked(voice.stop).mockReturnValueOnce(new Promise(resolve => { finishFade = resolve; }));
    await controller.start();

    const stopping = controller.stop();
    expect(controller.stop()).toBe(stopping);
    const restarting = controller.start();
    expect(graph.unregister).not.toHaveBeenCalled();
    expect(voice.dispose).not.toHaveBeenCalled();
    expect(factory.create).toHaveBeenCalledTimes(1);

    finishFade();
    await Promise.all([stopping, restarting]);
    expect(graph.unregister).toHaveBeenCalledOnce();
    expect(voice.dispose).toHaveBeenCalledOnce();
    expect(factory.create).toHaveBeenCalledTimes(2);
    expect(controller.isPlaying).toBe(true);
  });
});
