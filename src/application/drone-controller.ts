import type { DroneVoice, DroneVoiceFactory, SynthesizerController } from './audio-contracts';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
import { validateDroneSettings } from '../domain/drone';
/** Application orchestration; browser audio dependencies are injected. */
export class DroneController implements SynthesizerController {
  private voice: DroneVoice | null = null;
  private playing = false;
  private disposed = false;
  constructor(private readonly context: AudioContext, private readonly factory: DroneVoiceFactory, public settings: DroneSettings) { validateDroneSettings(settings); }
  get isPlaying(): boolean { return this.playing; }
  async start(): Promise<void> {
    if (this.disposed) throw new Error('Controller has been disposed.');
    if (this.playing) return;
    await this.context.resume();
    if (this.disposed || this.playing) return;
    const voice = this.factory.create(this.settings);
    voice.output.connect(this.context.destination);
    try { voice.start(); this.voice = voice; this.playing = true; } catch (error) { voice.dispose(); throw error; }
  }
  stop(): void { this.voice?.dispose(); this.voice = null; this.playing = false; }
  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid gain.');
    this.settings = {...this.settings, gain: value}; this.voice?.setGain(value);
  }
  updateOscillator(settings: OscillatorSettings): void {
    const next = {...this.settings, oscillators: this.settings.oscillators.map(item => item.id === settings.id ? settings : item)};
    if (!this.settings.oscillators.some(item => item.id === settings.id)) throw new Error('Unknown oscillator.');
    validateDroneSettings(next);
    this.voice?.updateOscillator(settings);
    this.settings = next;
  }
  dispose(): void { this.stop(); this.disposed = true; }
}
