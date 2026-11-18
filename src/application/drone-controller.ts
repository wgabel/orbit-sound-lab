import { getOscillatorModulationRange, validateOscillatorModulationRoutes } from '../domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute } from '../domain/oscillator-modulation';
import type { DroneVoice, DroneVoiceFactory, SynthesizerController } from './audio-contracts';
import type { ModulationMatrix, ModulationSource, ModulationSourceFactory, ModulationDestination } from './modulation-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { limitFilterModulationDepth, validateLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { AudioGraph } from './audio-graph-contracts';
import type { DroneMixSettings, DroneSettings, OscillatorSettings } from '../domain/drone';
import { validateDroneMix, validateDroneSettings } from '../domain/drone';

interface ActiveModulation { readonly source: ModulationSource; readonly destinations: readonly ModulationDestination[]; readonly target: LowFrequencyOscillatorSettings['destination']; }

/** Coordinates one independent routable LFO per drone oscillator. */
export class DroneController implements SynthesizerController {
  private voice: DroneVoice | null = null;
  private pitchBend = 0;
  private playing = false;
  private disposed = false;
  private stopping: Promise<void> | null = null;
  private readonly activeModulations = new Map<string, ActiveModulation>();
  private modulationKey(settings: LowFrequencyOscillatorSettings): string { return `${settings.targetOscillatorId}:${settings.destination}`; }

  constructor(
    private readonly context: AudioContext,
    private readonly factory: DroneVoiceFactory,
    private readonly graph: AudioGraph,
    private readonly modulationMatrix: ModulationMatrix,
    private readonly modulationFactory: ModulationSourceFactory,
    public settings: DroneSettings,
    public lowFrequencyOscillatorSettings: readonly LowFrequencyOscillatorSettings[],
    private readonly moduleId = 'drone',
    private readonly outputRoute = {moduleId: 'effects', portId: 'audio'}
  ) {
    validateDroneSettings(settings);
    this.validateModulationBank(lowFrequencyOscillatorSettings);
  }

  get sampleRate(): number { return this.context.sampleRate; }
  get isPlaying(): boolean { return this.playing; }
  readOscillatorFrequency(oscillatorId: string): number | null {
    return this.playing ? this.voice?.readOscillatorFrequency?.(oscillatorId) ?? null : null;
  }

  getWaveformAnalyser(oscillatorId: string): AnalyserNode | null {
    return this.voice?.getWaveformAnalyser?.(oscillatorId) ?? null;
  }

  getOscillatorModulationAnalyser(targetId: string, parameter: OscillatorModulationParameter): AnalyserNode | null {
    return this.playing ? this.voice?.getOscillatorModulationAnalyser?.(targetId, parameter) ?? null : null;
  }

  async start(): Promise<void> {
    if (this.stopping) await this.stopping;
    if (this.disposed) throw new Error('Controller has been disposed.');
    if (this.playing) return;
    await this.context.resume();
    if (this.disposed || this.playing) return;
    const voice = this.factory.create(this.settings);
    try {
      this.graph.register({id: this.moduleId, inputs: [], outputs: [{id: 'audio', node: voice.output}]});
      this.graph.connect({sourceModuleId: this.moduleId, sourcePortId: 'audio', destinationModuleId: this.outputRoute.moduleId, destinationPortId: this.outputRoute.portId});
      for (const settings of this.lowFrequencyOscillatorSettings) {
        if (settings.enabled) {
          this.attachModulation(voice, settings);
          if (settings.destination === 'amplitude') voice.setAmplitudeModulationEnabled?.(settings.targetOscillatorId, true);
        }
      }
      if (this.pitchBend !== 0) voice.setPitchBend(this.pitchBend);
      voice.start();
      this.voice = voice;
      this.playing = true;
    } catch (error) {
      this.detachAllModulations();
      this.graph.unregister(this.moduleId);
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
    const source = this.modulationFactory.create(this.getEffectiveModulation(settings));
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

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const voice = this.voice;
    if (!voice) return Promise.resolve();
    this.playing = false;
    this.stopping = voice.stop().finally(() => {
      if (this.voice === voice) this.releaseVoice();
      this.stopping = null;
    });
    return this.stopping;
  }

  private releaseVoice(): void {
    this.detachAllModulations();
    this.graph.unregister(this.moduleId);
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
    if (this.playing) {
      if (!settings.enabled) this.detachModulation(key);
      else if (active) active.source.update(this.getEffectiveModulation(settings));
      else if (this.voice) this.attachModulation(this.voice, settings);
      if (settings.destination === 'amplitude') {
        this.voice?.setAmplitudeModulationEnabled?.(settings.targetOscillatorId, settings.enabled);
      }
    }
    this.lowFrequencyOscillatorSettings = this.lowFrequencyOscillatorSettings.map((item, itemIndex) => itemIndex === index ? settings : item);
  }

  private getEffectiveModulation(settings: LowFrequencyOscillatorSettings): LowFrequencyOscillatorSettings {
    if (settings.destination !== 'filterCutoff') return settings;
    const oscillator = this.settings.oscillators.find(item => item.id === settings.targetOscillatorId);
    if (!oscillator) throw new Error('Unknown LFO target oscillator.');
    const cutoff = oscillator.filter.cutoffHz;
    const route = this.settings.oscillatorModulations?.find(item =>
      item.enabled && item.parameter === 'cutoff' && item.targetId === oscillator.id);
    const maximumDepth = limitFilterModulationDepth(Infinity, cutoff, this.context.sampleRate);
    const range = getOscillatorModulationRange(oscillator, 'cutoff', route?.depth ?? 0, this.context.sampleRate);
    const occupiedDepth = Math.max(cutoff - range.lower, range.upper - cutoff);
    return {...settings, depthHz: Math.min(settings.depthHz, Math.max(0, maximumDepth - occupiedDepth))};
  }

  setOscillatorModulations(routes: readonly OscillatorModulationRoute[]): void {
    validateOscillatorModulationRoutes(routes, this.settings.oscillators);
    if (this.playing) this.voice?.setOscillatorModulations(routes);
    this.settings = {...this.settings, oscillatorModulations: routes};
    if (this.playing) {
      for (const modulation of this.lowFrequencyOscillatorSettings) {
        if (modulation.destination === 'filterCutoff') {
          this.activeModulations.get(this.modulationKey(modulation))?.source.update(this.getEffectiveModulation(modulation));
        }
      }
    }
  }

  setPitchBend(cents: number): void {
    this.pitchBend = cents;
    this.voice?.setPitchBend(cents);
  }

  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid gain.');
    this.settings = {...this.settings, gain: value};
    if (this.playing) this.voice?.setGain(value);
  }

  setMix(mix: DroneMixSettings): void {
    validateDroneMix(mix);
    if (this.playing) this.voice?.setMix(mix);
    this.settings = {...this.settings, mix};
  }

  updateOscillator(settings: OscillatorSettings): void {
    if (!this.settings.oscillators.some(item => item.id === settings.id)) throw new Error('Unknown oscillator.');
    const next = {...this.settings, oscillators: this.settings.oscillators.map(item => item.id === settings.id ? settings : item)};
    validateDroneSettings(next);
    const previous = this.settings.oscillators.find(item => item.id === settings.id);
    if (this.playing) this.voice?.updateOscillator(settings);
    this.settings = next;
    if (this.playing && previous?.filter.cutoffHz !== settings.filter.cutoffHz) {
      const modulation = this.lowFrequencyOscillatorSettings.find(item =>
        item.targetOscillatorId === settings.id && item.destination === 'filterCutoff');
      if (modulation) this.activeModulations.get(this.modulationKey(modulation))?.source.update(this.getEffectiveModulation(modulation));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.releaseVoice();
    this.modulationMatrix.dispose();
    this.disposed = true;
  }
}
