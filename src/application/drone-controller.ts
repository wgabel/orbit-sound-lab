import type { DroneVoice, DroneVoiceFactory, SynthesizerController } from './audio-contracts';
import type { ModulationMatrix, ModulationSource, ModulationSourceFactory, ModulationDestination } from './modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { validateLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { AudioGraph } from './audio-graph-contracts';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
import { validateDroneSettings } from '../domain/drone';

interface ActiveModulation { readonly source: ModulationSource; readonly destinations: readonly ModulationDestination[]; readonly target: LowFrequencyOscillatorSettings['destination']; }

/** Coordinates one independent routable LFO per drone oscillator. */
export class DroneController implements SynthesizerController {
  private voice: DroneVoice | null = null;
  private playing = false;
  private disposed = false;
  private readonly activeModulations = new Map<string, ActiveModulation>();
  private modulationKey(settings: LowFrequencyOscillatorSettings): string { return `${settings.targetOscillatorId}:${settings.destination}`; }

  constructor(
    private readonly context: AudioContext,
    private readonly factory: DroneVoiceFactory,
    private readonly graph: AudioGraph,
    private readonly modulationMatrix: ModulationMatrix,
    private readonly modulationFactory: ModulationSourceFactory,
    public settings: DroneSettings,
    public lowFrequencyOscillatorSettings: readonly LowFrequencyOscillatorSettings[]
  ) {
    validateDroneSettings(settings);
    this.validateModulationBank(lowFrequencyOscillatorSettings);
  }

  get isPlaying(): boolean { return this.playing; }

  async start(): Promise<void> {
    if (this.disposed) throw new Error('Controller has been disposed.');
    if (this.playing) return;
    await this.context.resume();
    if (this.disposed || this.playing) return;
    const voice = this.factory.create(this.settings);
    try {
      this.graph.register({id: 'drone', inputs: [], outputs: [{id: 'audio', node: voice.output}]});
      this.graph.connect({sourceModuleId: 'drone', sourcePortId: 'audio', destinationModuleId: 'effects', destinationPortId: 'audio'});
      for (const settings of this.lowFrequencyOscillatorSettings) {
        if (settings.enabled) this.attachModulation(voice, settings);
      }
      voice.start();
      this.voice = voice;
      this.playing = true;
    } catch (error) {
      this.detachAllModulations();
      this.graph.unregister('drone');
      voice.dispose();
      throw error;
    }
  }

  private validateModulationBank(settings: readonly LowFrequencyOscillatorSettings[]): void {
    const oscillatorIds = new Set(this.settings.oscillators.map(oscillator => oscillator.id));
    const targets = new Set<string>();
    if (settings.length !== oscillatorIds.size * 3) throw new Error('Each oscillator requires three LFO configurations.');
    for (const item of settings) {
      validateLowFrequencyOscillatorSettings(item);
      if (!oscillatorIds.has(item.targetOscillatorId) || targets.has(this.modulationKey(item))) throw new Error('LFO targets must be unique and match oscillator identifiers.');
      targets.add(this.modulationKey(item));
    }
  }

  private attachModulation(voice: DroneVoice, settings: LowFrequencyOscillatorSettings): void {
    const source = this.modulationFactory.create(settings);
    const parameters = settings.destination === 'pitch' ? [voice.getDetuneParameter(settings.targetOscillatorId)] : settings.destination === 'amplitude' ? [voice.getAmplitudeParameter(settings.targetOscillatorId)] : voice.getFilterCutoffParameters(settings.targetOscillatorId);
    const destinations: ModulationDestination[] = parameters.map((parameter, index) => ({id: settings.destination === 'pitch' ? settings.targetOscillatorId : `${settings.targetOscillatorId}-cutoff-${index}`, parameter}));
    const connected: ModulationDestination[] = [];
    try {
      for (const destination of destinations) { this.modulationMatrix.connect(source, destination); connected.push(destination); }
      source.start();
      this.activeModulations.set(this.modulationKey(settings), {source, destinations, target: settings.destination});
    } catch (error) {
      for (const destination of connected) this.modulationMatrix.disconnect(source, destination);
      source.dispose();
      throw error;
    }
  }

  private detachModulation(modulationKey: string): void {
    const active = this.activeModulations.get(modulationKey);
    if (!active) return;
    for (const destination of active.destinations) this.modulationMatrix.disconnect(active.source, destination);
    active.source.dispose();
    this.activeModulations.delete(modulationKey);
  }

  private detachAllModulations(): void {
    for (const modulationKey of [...this.activeModulations.keys()]) this.detachModulation(modulationKey);
  }

  stop(): void {
    this.detachAllModulations();
    this.graph.unregister('drone');
    this.voice?.dispose();
    this.voice = null;
    this.playing = false;
  }

  updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings): void {
    if (this.disposed) throw new Error('Controller has been disposed.');
    validateLowFrequencyOscillatorSettings(settings);
    const index = this.lowFrequencyOscillatorSettings.findIndex(item => item.targetOscillatorId === settings.targetOscillatorId && item.destination === settings.destination);
    if (index < 0) throw new Error('Unknown LFO target oscillator.');
    const key = this.modulationKey(settings);
    const active = this.activeModulations.get(key);
    if (!settings.enabled) this.detachModulation(key);
    else if (active) active.source.update(settings);
    else if (active && this.voice) { this.detachModulation(settings.targetOscillatorId); this.attachModulation(this.voice, settings); }
    else if (this.voice) this.attachModulation(this.voice, settings);
    this.lowFrequencyOscillatorSettings = this.lowFrequencyOscillatorSettings.map((item, itemIndex) => itemIndex === index ? settings : item);
  }

  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid gain.');
    this.settings = {...this.settings, gain: value};
    this.voice?.setGain(value);
  }

  updateOscillator(settings: OscillatorSettings): void {
    if (!this.settings.oscillators.some(item => item.id === settings.id)) throw new Error('Unknown oscillator.');
    const next = {...this.settings, oscillators: this.settings.oscillators.map(item => item.id === settings.id ? settings : item)};
    validateDroneSettings(next);
    this.voice?.updateOscillator(settings);
    this.settings = next;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.graph.dispose();
    this.modulationMatrix.dispose();
    this.disposed = true;
  }
}
