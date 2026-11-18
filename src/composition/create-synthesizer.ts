import type { SynthesizerController } from '../application/audio-contracts';
import { createDefaultLowFrequencyOscillators } from '../domain/modulation';
import { WebAudioModulationMatrix } from '../infrastructure/audio/web-audio-modulation-matrix';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
import { DroneController } from '../application/drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '../infrastructure/audio/web-audio-graph';

export function createSynthesizer(): SynthesizerController {
  const context = new AudioContext({latencyHint: 'playback'});
  const graph = new WebAudioGraph();
  const settings = createDefaultDroneSettings();
  graph.register({id: 'master', inputs: [{id: 'audio', node: context.destination}], outputs: []});
  const controller = new DroneController(context, new WebAudioDroneFactory(context), graph, new WebAudioModulationMatrix(), new WebAudioLowFrequencyOscillatorFactory(context), settings, createDefaultLowFrequencyOscillators(settings.oscillators.map(oscillator => oscillator.id)));
  return {
    get settings() { return controller.settings; },
    get isPlaying() { return controller.isPlaying; },
    get lowFrequencyOscillatorSettings() { return controller.lowFrequencyOscillatorSettings; },
    updateLowFrequencyOscillator: settings => controller.updateLowFrequencyOscillator(settings),
    start: () => controller.start(),
    stop: () => controller.stop(),
    setGain: value => controller.setGain(value),
    updateOscillator: settings => controller.updateOscillator(settings),
    dispose: () => { controller.dispose(); void context.close(); }
  };
}
