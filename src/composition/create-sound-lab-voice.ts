import { MAX_DRONE_BEND_CENTS } from '../domain/drone-envelope';
import { WebAudioDroneGate } from '../infrastructure/audio/web-audio-drone-gate';
import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import { DRONE_LAYER_IDS, createDefaultDroneLayer, validateMasterGain } from '../domain/drone-layers';
import type { DroneLayerId } from '../domain/drone-layers';
import { WebAudioPerformanceMix } from '../infrastructure/audio/web-audio-performance-mix';
import { WebAudioDelay } from '../infrastructure/audio/web-audio-delay';
import type { SoundLabVoiceController } from '../application/audio-contracts';
import { tuneSceneLayer } from '../domain/sound-scene';
import type { SoundScene } from '../domain/sound-scene';
import { WebAudioModulationMatrix } from '../infrastructure/audio/web-audio-modulation-matrix';
import type { WebAudioPulseWorkletFactory } from '../infrastructure/audio/web-audio-pulse-worklet';
import { WebAudioLfoWorkletFactory } from '../infrastructure/audio/web-audio-lfo-worklet';
import { WebAudioLowFrequencyOscillatorFactory } from '../infrastructure/audio/web-audio-low-frequency-oscillator';
import { DroneController } from '../application/drone-controller';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
import { WebAudioGraph } from '../infrastructure/audio/web-audio-graph';

export interface SoundLabVoice extends SoundLabVoiceController {
  fadeSources(start: number, end: number): void;
}

export function createSoundLabVoice(context: AudioContext, destination: AudioNode,
  lfoWorklet: WebAudioLfoWorkletFactory, pulseWorklet: WebAudioPulseWorkletFactory,
  modulationFactory: WebAudioLowFrequencyOscillatorFactory,
  scene?: SoundScene): SoundLabVoice {
  const graph = new WebAudioGraph();
  let delaySettings: DelaySettings = scene?.delay ?? createDefaultDelaySettings();
  const delay = new WebAudioDelay(context, delaySettings);
  const masterGain = context.createGain();
  masterGain.gain.value = scene?.masterGain ?? 1;
  const performance = new WebAudioPerformanceMix(context);
  if (scene) performance.setPosition(scene.performancePosition);
  const gates = {A: new WebAudioDroneGate(context), B: new WebAudioDroneGate(context)};
  gates.A.node.connect(performance.inputA);
  gates.B.node.connect(performance.inputB);
  graph.register({id: 'performance', inputs: DRONE_LAYER_IDS.map(id => ({id, node: gates[id].node})),
    outputs: [{id: 'audio', node: performance.output}]});
  graph.register({id: 'effects', inputs: [{id: 'audio', node: delay.input}], outputs: [{id: 'audio', node: delay.output}]});
  graph.register({id: 'master-level', inputs: [{id: 'audio', node: masterGain}], outputs: [{id: 'audio', node: masterGain}]});
  graph.register({id: 'master', inputs: [{id: 'audio', node: destination}], outputs: []});
  graph.connect({sourceModuleId: 'performance', sourcePortId: 'audio', destinationModuleId: 'effects', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'effects', sourcePortId: 'audio', destinationModuleId: 'master-level', destinationPortId: 'audio'});
  graph.connect({sourceModuleId: 'master-level', sourcePortId: 'audio', destinationModuleId: 'master', destinationPortId: 'audio'});

  function createLayerController(id: DroneLayerId) {
    const layer = scene?.layers[id] ?? createDefaultDroneLayer(id);
    gates[id].setEnvelope(layer.drone.envelope);
    return new DroneController(context, new WebAudioDroneFactory(context, pulseWorklet), graph, new WebAudioModulationMatrix(),
      modulationFactory, tuneSceneLayer(layer), layer.modulation, `drone-${id}`, {moduleId: 'performance', portId: id});
  }

  const layers = {A: createLayerController('A'), B: createLayerController('B')};
  let enabled: Readonly<Record<DroneLayerId, boolean>> = {A: scene?.layers.A.enabled ?? true, B: scene?.layers.B.enabled ?? false};
  const holdModes = {A: false, B: false};
  const armedLayers = new Set<DroneLayerId>();
  const pressedKeys = new Map<DroneLayerId, symbol>();
  let continuousPlayback = false;
  let playing = false;
  let disposed = false;
  let transition = Promise.resolve();

  function synchronizeLayers(): Promise<void> {
    // Serialize graph changes while oscillator fades complete.
    const next = transition.then(async () => {
      if (disposed) return;
      const results = await Promise.allSettled(DRONE_LAYER_IDS.map(id =>
        playing && (holdModes[id] ? armedLayers.has(id) : continuousPlayback && enabled[id])
          ? layers[id].start() : layers[id].stop()));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    });
    transition = next.catch(() => undefined);
    return next;
  }

  return {
    layers,
    fadeSources(start, end) {
      for (const id of DRONE_LAYER_IDS) layers[id].fadeSources(start, end);
    },
    get delaySettings() { return delaySettings; },
    updateDelay: settings => { delay.update(settings); delaySettings = settings; },
    get isPlaying() { return playing; },
    async start() {
      playing = true;
      continuousPlayback = true;
      try {
        // Resume on Start even when both layers are disabled.
        await Promise.all([context.resume(), lfoWorklet.prepare(), pulseWorklet.prepare()]);
        await synchronizeLayers();
      } catch (error) {
        playing = false;
        continuousPlayback = false;
        await synchronizeLayers();
        throw error;
      }
    },
    async stop() {
      playing = false;
      continuousPlayback = false;
      pressedKeys.clear();
      armedLayers.clear();
      await synchronizeLayers();
      for (const id of DRONE_LAYER_IDS) {
        if (pressedKeys.has(id)) continue;
        layers[id].setPitchBend(0);
        gates[id].reset(!holdModes[id]);
      }
    },
    setLayerHoldMode(id, holding) {
      if (holding === holdModes[id]) return Promise.resolve();
      holdModes[id] = holding;
      pressedKeys.delete(id);
      armedLayers.delete(id);
      layers[id].setPitchBend(0);
      if (holding && layers[id].isPlaying) armedLayers.add(id);
      if (layers[id].isPlaying) gates[id].setContinuous(!holding);
      else gates[id].reset(!holding);
      return playing ? synchronizeLayers() : Promise.resolve();
    },
    setLayerEnvelope: (id, envelope) => gates[id].setEnvelope(envelope),
    async pressLayerKey(id) {
      if (!holdModes[id] || pressedKeys.has(id)) return;
      const press = Symbol();
      pressedKeys.set(id, press);
      layers[id].setPitchBend(0);
      playing = true;
      try {
        await Promise.all([context.resume(), lfoWorklet.prepare(), pulseWorklet.prepare()]);
        if (pressedKeys.get(id) !== press) return;
        if (!layers[id].isPlaying) {
          armedLayers.add(id);
          await synchronizeLayers();
        }
        if (pressedKeys.get(id) === press) gates[id].trigger();
      } catch (error) {
        if (pressedKeys.get(id) === press) {
          pressedKeys.delete(id);
          armedLayers.delete(id);
          if (!continuousPlayback && !armedLayers.size && !pressedKeys.size) playing = false;
        }
        throw error;
      }
    },
    releaseLayerKey(id) {
      if (pressedKeys.delete(id)) gates[id].release();
    },
    setLayerBend(id, cents) {
      if (!pressedKeys.has(id) || !Number.isFinite(cents)) return;
      layers[id].setPitchBend(Math.max(-MAX_DRONE_BEND_CENTS, Math.min(MAX_DRONE_BEND_CENTS, cents)));
    },
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
      if (disposed) return;
      disposed = true;
      playing = false;
      for (const id of DRONE_LAYER_IDS) layers[id].dispose();
      graph.dispose();
      masterGain.disconnect();
      for (const id of DRONE_LAYER_IDS) gates[id].node.disconnect();
      performance.dispose();
      delay.dispose();
    }
  };
}
