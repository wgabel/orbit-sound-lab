import type { DroneVoice, DroneVoiceFactory } from '../../application/audio-contracts';
import type { DroneSettings } from '../../domain/drone';
import { WebAudioDrone } from './web-audio-drone';
export class WebAudioDroneFactory implements DroneVoiceFactory {
  constructor(private readonly context: AudioContext) {}
  create(settings: DroneSettings): DroneVoice { return new WebAudioDrone(this.context, settings); }
}
