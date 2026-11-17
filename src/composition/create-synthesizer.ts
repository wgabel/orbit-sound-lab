import type { SynthesizerController } from '../application/audio-contracts';
import { DroneController } from '../application/drone-controller';
import { createDefaultDroneSettings } from '../domain/drone';
import { WebAudioDroneFactory } from '../infrastructure/audio/web-audio-drone-factory';
/** Composition root: the only place wiring concrete Web Audio implementations. */
export function createSynthesizer(): SynthesizerController {
  const context = new AudioContext();
  const factory = new WebAudioDroneFactory(context);
  const controller = new DroneController(context, factory, createDefaultDroneSettings());
  return { get settings() { return controller.settings; }, get isPlaying() { return controller.isPlaying; }, start: () => controller.start(), stop: () => controller.stop(), setGain: value => controller.setGain(value), updateOscillator: settings => controller.updateOscillator(settings), dispose: () => { controller.dispose(); void context.close(); } };
}
