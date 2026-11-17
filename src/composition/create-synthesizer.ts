import type { SynthesizerController } from '../application/audio-contracts';
import { DroneController } from '../application/drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '../infrastructure/audio/web-audio-graph';
/** Composition root: the only place wiring concrete Web Audio implementations. */
export function createSynthesizer(): SynthesizerController {
  const context = new AudioContext();
  const factory = new WebAudioDroneFactory(context);
  const graph = new WebAudioGraph();
  graph.register({id: 'master', inputs: [{id: 'audio', node: context.destination}], outputs: []});
  const controller = new DroneController(context, factory, graph, createDefaultDroneSettings());
  return { get settings() { return controller.settings; }, get isPlaying() { return controller.isPlaying; }, start: () => controller.start(), stop: () => controller.stop(), setGain: value => controller.setGain(value), updateOscillator: settings => controller.updateOscillator(settings), dispose: () => { controller.dispose(); void context.close(); } };
}
