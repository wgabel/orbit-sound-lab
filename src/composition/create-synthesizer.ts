import type { SynthesizerController } from '../application/audio-contracts';
import { createDefaultLowFrequencyOscillatorSettings } from '../domain/modulation';
import { WebAudioModulationMatrix } from '../infrastructure/audio/web-audio-modulation-matrix';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
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
  const controller = new DroneController(context, factory, graph, new WebAudioModulationMatrix(), new WebAudioLowFrequencyOscillatorFactory(context), createDefaultDroneSettings(), createDefaultLowFrequencyOscillatorSettings());
  return { get settings() { return controller.settings; }, get isPlaying() { return controller.isPlaying; }, get lowFrequencyOscillatorSettings() { return controller.lowFrequencyOscillatorSettings; }, updateLowFrequencyOscillator: settings => controller.updateLowFrequencyOscillator(settings), start: () => controller.start(), stop: () => controller.stop(), setGain: value => controller.setGain(value), updateOscillator: settings => controller.updateOscillator(settings), dispose: () => { controller.dispose(); void context.close(); } };
}
