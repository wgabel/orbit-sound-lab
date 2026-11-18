import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import { WebAudioOutputProtection } from '../infrastructure/audio/web-audio-output-protection';
import { WebAudioDelay } from '../infrastructure/audio/web-audio-delay';
import type { SoundLabController } from '../application/audio-contracts';
import { createDefaultLowFrequencyOscillators } from '../domain/modulation';
import { WebAudioModulationMatrix } from '../infrastructure/audio/web-audio-modulation-matrix';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
import { DroneController } from '../application/drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '../infrastructure/audio/web-audio-graph';

export function createSynthesizer(): SoundLabController {
  const context = new AudioContext({latencyHint: 'playback'});
  const graph = new WebAudioGraph();
  const settings = createDefaultDroneSettings();
  const delay = new WebAudioDelay(context, createDefaultDelaySettings());
  let delaySettings: DelaySettings = createDefaultDelaySettings();
  const outputProtection = new WebAudioOutputProtection(context);
  graph.register({id: 'effects', inputs: [{id: 'audio', node: delay.input}], outputs: [{id: 'audio', node: delay.output}]});
  graph.register({id: 'output-protection', inputs: [{id: 'audio', node: outputProtection.input}], outputs: [{id: 'audio', node: outputProtection.output}]});
  graph.register({id: 'master', inputs: [{id: 'audio', node: context.destination}], outputs: []});
  graph.connect({sourceModuleId: 'effects', sourcePortId: 'audio', destinationModuleId: 'output-protection', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'output-protection', sourcePortId: 'audio', destinationModuleId: 'master', destinationPortId: 'audio'});
  const controller = new DroneController(context, new WebAudioDroneFactory(context), graph, new WebAudioModulationMatrix(), new WebAudioLowFrequencyOscillatorFactory(context), settings, createDefaultLowFrequencyOscillators(settings.oscillators.map(oscillator => oscillator.id)));
  return {
    get settings() { return controller.settings; },
    get delaySettings() { return delaySettings; },
    updateDelay: settings => { delay.update(settings); delaySettings = settings; },
    get isPlaying() { return controller.isPlaying; },
    get lowFrequencyOscillatorSettings() { return controller.lowFrequencyOscillatorSettings; },
    updateLowFrequencyOscillator: settings => controller.updateLowFrequencyOscillator(settings),
    start: () => controller.start(),
    stop: () => controller.stop(),
    setGain: value => controller.setGain(value),
    updateOscillator: settings => controller.updateOscillator(settings),
    dispose: () => { controller.dispose(); graph.dispose(); delay.dispose(); outputProtection.dispose(); void context.close(); }
  };
}
