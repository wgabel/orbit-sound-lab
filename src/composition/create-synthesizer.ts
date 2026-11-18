import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import { DRONE_LAYER_IDS, createDefaultDroneLayer, validateMasterGain } from '../domain/drone-layers';
import type { DroneLayerId } from '../domain/drone-layers';
import { WebAudioPerformanceMix } from '../infrastructure/audio/web-audio-performance-mix';
import { WebAudioOutputProtection } from '../infrastructure/audio/web-audio-output-protection';
import { WebAudioDelay } from '../infrastructure/audio/web-audio-delay';
import type { SoundLabController } from '../application/audio-contracts';
import { WebAudioModulationMatrix } from '../infrastructure/audio/web-audio-modulation-matrix';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
import { DroneController } from '../application/drone-controller';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '../infrastructure/audio/web-audio-graph';

export function createSynthesizer(): SoundLabController {
  const context = new AudioContext({latencyHint: 'playback'});
  const graph = new WebAudioGraph();
  let delaySettings: DelaySettings = createDefaultDelaySettings();
  const delay = new WebAudioDelay(context, delaySettings);
  const outputProtection = new WebAudioOutputProtection(context);
  const masterGain = context.createGain();
  const performance = new WebAudioPerformanceMix(context);
  graph.register({id: 'performance', inputs: [{id: 'A', node: performance.inputA}, {id: 'B', node: performance.inputB}],
    outputs: [{id: 'audio', node: performance.output}]});
  graph.register({id: 'effects', inputs: [{id: 'audio', node: delay.input}], outputs: [{id: 'audio', node: delay.output}]});
  graph.register({id: 'master-level', inputs: [{id: 'audio', node: masterGain}], outputs: [{id: 'audio', node: masterGain}]});
  graph.register({id: 'output-protection', inputs: [{id: 'audio', node: outputProtection.input}], outputs: [{id: 'audio', node: outputProtection.output}]});
  graph.register({id: 'master', inputs: [{id: 'audio', node: context.destination}], outputs: []});
  graph.connect({sourceModuleId: 'performance', sourcePortId: 'audio', destinationModuleId: 'effects', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'effects', sourcePortId: 'audio', destinationModuleId: 'master-level', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'master-level', sourcePortId: 'audio', destinationModuleId: 'output-protection', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'output-protection', sourcePortId: 'audio', destinationModuleId: 'master', destinationPortId: 'audio'});

  function createLayerController(id: DroneLayerId) {
    const {drone, modulation} = createDefaultDroneLayer(id);
    return new DroneController(context, new WebAudioDroneFactory(context), graph, new WebAudioModulationMatrix(),
      new WebAudioLowFrequencyOscillatorFactory(context), drone, modulation, `drone-${id}`, {moduleId: 'performance', portId: id});
  }

  const layers = {A: createLayerController('A'), B: createLayerController('B')};
  let enabled: Readonly<Record<DroneLayerId, boolean>> = {A: true, B: false};
  let playing = false;
  let disposed = false;
  let transition = Promise.resolve();

  function synchronizeLayers(): Promise<void> {
    // Serialize graph changes while oscillator fades complete.
    const next = transition.then(async () => {
      if (disposed) return;
      const results = await Promise.allSettled(DRONE_LAYER_IDS.map(id =>
        playing && enabled[id] ? layers[id].start() : layers[id].stop()));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    });
    transition = next.catch(() => undefined);
    return next;
  }

  return {
    layers,
    get delaySettings() { return delaySettings; },
    updateDelay: settings => { delay.update(settings); delaySettings = settings; },
    get isPlaying() { return playing; },
    async start() {
      playing = true;
      try {
        // Resume on Start even when both layers are disabled.
        await context.resume();
        await synchronizeLayers();
      } catch (error) {
        playing = false;
        await synchronizeLayers();
        throw error;
      }
    },
    stop() { playing = false; return synchronizeLayers(); },
    setLayersEnabled(next) {
      if (next.A === enabled.A && next.B === enabled.B) return Promise.resolve();
      enabled = next;
      return playing ? synchronizeLayers() : Promise.resolve();
    },
    setMasterGain(gain) {
      validateMasterGain(gain);
      masterGain.gain.setTargetAtTime(gain, context.currentTime, 0.015);
    },
    setPerformancePosition: position => performance.setPosition(position),
    dispose() {
      disposed = true;
      playing = false;
      for (const id of DRONE_LAYER_IDS) layers[id].dispose();
      graph.dispose();
      masterGain.disconnect();
      performance.dispose();
      delay.dispose();
      outputProtection.dispose();
      void context.close();
    }
  };
}
