import type { DroneVoice, DroneVoiceFactory, SynthesizerController } from './audio-contracts';
import type { ModulationMatrix, ModulationSource, ModulationSourceFactory, ModulationDestination } from './modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { validateLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { AudioGraph } from './audio-graph-contracts';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
import { validateDroneSettings } from '../domain/drone';
/** Application orchestration; browser audio dependencies are injected. */
export class DroneController implements SynthesizerController {
  private voice: DroneVoice | null = null;
  private playing = false;
  private disposed = false;
  private modulationSource: ModulationSource | null = null;
  private modulationDestination: ModulationDestination | null = null;
  constructor(private readonly context: AudioContext, private readonly factory: DroneVoiceFactory, private readonly graph: AudioGraph, private readonly modulationMatrix: ModulationMatrix, private readonly modulationFactory: ModulationSourceFactory, public settings: DroneSettings, public lowFrequencyOscillatorSettings: LowFrequencyOscillatorSettings) { validateDroneSettings(settings); }
  get isPlaying(): boolean { return this.playing; }
  async start(): Promise<void> {
    if (this.disposed) throw new Error('Controller has been disposed.');
    if (this.playing) return;
    await this.context.resume();
    if (this.disposed || this.playing) return;
    const voice = this.factory.create(this.settings);
    try {
      this.graph.register({id: 'drone', inputs: [], outputs: [{id: 'audio', node: voice.output}]});
      this.graph.connect({sourceModuleId: 'drone', sourcePortId: 'audio', destinationModuleId: 'master', destinationPortId: 'audio'});
      const modulationSource = this.modulationFactory.create(this.lowFrequencyOscillatorSettings);
      const modulationDestination = {id: this.lowFrequencyOscillatorSettings.targetOscillatorId, parameter: voice.getDetuneParameter(this.lowFrequencyOscillatorSettings.targetOscillatorId)};
      this.modulationMatrix.connect(modulationSource, modulationDestination);
      try { modulationSource.start(); voice.start(); } catch (error) {
        this.modulationMatrix.disconnect(modulationSource, modulationDestination);
        modulationSource.dispose();
        throw error;
      }
      this.modulationSource = modulationSource;
      this.modulationDestination = modulationDestination;
      this.voice = voice;
      this.playing = true;
    } catch (error) {
      this.graph.unregister('drone');
      voice.dispose();
      throw error;
    }
  }
  stop(): void {
    if (this.modulationSource && this.modulationDestination) this.modulationMatrix.disconnect(this.modulationSource, this.modulationDestination);
    this.modulationSource?.dispose(); this.modulationSource = null; this.modulationDestination = null;
    this.graph.unregister('drone'); this.voice?.dispose(); this.voice = null; this.playing = false; }
  updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings): void {
    validateLowFrequencyOscillatorSettings(settings);
    if (!this.settings.oscillators.some(oscillator => oscillator.id === settings.targetOscillatorId)) throw new Error('Unknown LFO target oscillator.');
    if (this.modulationSource && this.voice && this.modulationDestination) {
      if (this.modulationDestination.id !== settings.targetOscillatorId) {
        const destination = {id: settings.targetOscillatorId, parameter: this.voice.getDetuneParameter(settings.targetOscillatorId)};
        this.modulationMatrix.connect(this.modulationSource, destination);
        this.modulationMatrix.disconnect(this.modulationSource, this.modulationDestination);
        this.modulationDestination = destination;
      }
      this.modulationSource.update(settings);
    }
    this.lowFrequencyOscillatorSettings = settings;
  }
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
  dispose(): void { if (this.disposed) return; this.stop(); this.graph.dispose(); this.modulationMatrix.dispose(); this.disposed = true; }
}
