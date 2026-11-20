import { AMPLITUDE_LFO_CENTER } from '@domain/modulation';
import { getOscillatorModulationRange, usesWaveformFrequency } from '@domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute } from '@domain/oscillator-modulation';
import { WebAudioOscillatorModulation } from './web-audio-oscillator-modulation';
import type { DroneVoice } from '@application/audio-contracts';
import type { DroneMixSettings, DroneSettings, OscillatorSettings } from '@domain/drone';
import { validateDroneSettings, validateLowPassFilterSettings } from '@domain/drone';
import type { WebAudioPulseWorkletFactory } from './web-audio-pulse-worklet';
import { WebAudioWaveformSource } from './web-audio-waveform-source';
import { WebAudioDroneMix } from './web-audio-drone-mix';
import { PLAYBACK_FADE_SECONDS, fadeGain } from './web-audio-fade';

/** Spread resonance across two stages to avoid squaring the full UI Q peak. */
export function mapResonanceToStageQ(resonance: number): number {
  return Math.sqrt(resonance);
}

// Restore the previous unity-gain mono upmix at the panner's center.
const MONO_PAN_GAIN_COMPENSATION = Math.SQRT2;
// The level lane is unipolar (0–1); zero modulation corresponds to its midpoint.
const BIPOLAR_LEVEL_CURVE = new Float32Array([-1, -1, 1]);

interface OscillatorNodes {
  readonly source: WebAudioWaveformSource;
  readonly filter: BiquadFilterNode;
  readonly secondFilter: BiquadFilterNode;
  readonly cutoffControl: ConstantSourceNode;
  readonly dryGain: GainNode;
  readonly wetGain: GainNode;
  readonly gain: GainNode;
  readonly volumeControl: ConstantSourceNode;
  readonly fadeGain: GainNode;
  readonly panner: StereoPannerNode;
  readonly amplitudeGain: GainNode;
  readonly amplitudeControl: ConstantSourceNode;
  readonly modulationVolume: GainNode;
  readonly bipolarLevel: WaveShaperNode;
  readonly modulationLevel: GainNode;
  readonly modulationWaveform: GainNode;
  readonly waveformAnalyser: AnalyserNode;
  settings: OscillatorSettings;
  amplitudeModulated: boolean;
  cutoffPreview?: {analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>};
  volumePreview?: {product: GainNode; analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>};
}
/** Panned oscillator paths and centered noise feed the layer mix, then the drone level. */
export class WebAudioDrone implements DroneVoice {
  readonly output: GainNode;
  private readonly oscillatorVolumeScale: number;
  private readonly pitchBend: ConstantSourceNode;
  private readonly mix: WebAudioDroneMix;
  private mixSettings: DroneMixSettings;
  private readonly oscillators = new Map<string, OscillatorNodes>();
  private routes: readonly OscillatorModulationRoute[] = [];
  private readonly modulationRoutes = new Map<string, WebAudioOscillatorModulation>();
  private readonly fadingRoutes = new Set<WebAudioOscillatorModulation>();
  private started = false;
  private stopped = false;
  private disposed = false;
  private stopPromise: Promise<void> | null = null;
  private finishStop: (() => void) | null = null;
  constructor(private readonly context: AudioContext, settings: DroneSettings, pulseWorklet: WebAudioPulseWorkletFactory) {
    validateDroneSettings(settings);
    if (settings.oscillators.some(oscillator => oscillator.waveform === 'variablePulse')) pulseWorklet.assertAvailable();
    this.oscillatorVolumeScale = 2 / settings.oscillators.length;
    this.pitchBend = context.createConstantSource();
    this.pitchBend.offset.value = 0;
    this.output = context.createGain();
    this.output.gain.value = settings.gain * MONO_PAN_GAIN_COMPENSATION;
    this.mixSettings = settings.mix;
    this.mix = new WebAudioDroneMix(context, settings.mix, this.output);
    for (const oscillatorSettings of settings.oscillators) {
      const source = new WebAudioWaveformSource(context, oscillatorSettings, pulseWorklet);
      this.pitchBend.connect(source.detune);
      const filter = context.createBiquadFilter();
      const secondFilter = context.createBiquadFilter();
      const dryGain = context.createGain();
      const wetGain = context.createGain();
      const gain = context.createGain();
      const fadeGain = context.createGain();
      const panner = context.createStereoPanner();
      panner.pan.value = oscillatorSettings.pan;
      const amplitudeGain = context.createGain();
      const waveformAnalyser = context.createAnalyser();
      waveformAnalyser.fftSize = 2048;
      waveformAnalyser.smoothingTimeConstant = 0;
      filter.type = 'lowpass';
      secondFilter.type = 'lowpass';
      const cutoffControl = context.createConstantSource();
      cutoffControl.offset.value = oscillatorSettings.filter.cutoffHz;
      filter.frequency.value = 0;
      secondFilter.frequency.value = 0;
      cutoffControl.connect(filter.frequency);
      cutoffControl.connect(secondFilter.frequency);
      filter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      secondFilter.Q.value = mapResonanceToStageQ(oscillatorSettings.filter.resonance);
      dryGain.gain.value = oscillatorSettings.filter.enabled ? 0 : 1;
      wetGain.gain.value = oscillatorSettings.filter.enabled ? 1 : 0;
      gain.gain.value = 0;
      const volumeControl = context.createConstantSource();
      volumeControl.offset.value = this.oscillatorVolumeScale * oscillatorSettings.volume;
      volumeControl.connect(gain.gain);
      fadeGain.gain.value = 0;
      amplitudeGain.gain.value = 0;
      const amplitudeControl = context.createConstantSource();
      amplitudeControl.offset.value = AMPLITUDE_LFO_CENTER;
      const modulationVolume = context.createGain();
      modulationVolume.gain.value = oscillatorSettings.volume * 2;
      const bipolarLevel = context.createWaveShaper();
      bipolarLevel.curve = BIPOLAR_LEVEL_CURVE;
      const modulationLevel = context.createGain();
      modulationLevel.gain.value = 0;
      const modulationWaveform = context.createGain();
      modulationWaveform.gain.value = 0;
      source.modulationOutput.connect(modulationWaveform);
      // Follow the source volume and amplitude LFO upstream of incoming slider routes.
      amplitudeControl.connect(amplitudeGain.gain);
      amplitudeControl.connect(modulationVolume).connect(bipolarLevel).connect(modulationLevel);
      source.output.connect(dryGain);
      source.output.connect(filter);
      filter.connect(secondFilter);
      secondFilter.connect(wetGain);
      dryGain.connect(gain);
      wetGain.connect(gain);
      gain.connect(amplitudeGain);
      amplitudeGain.connect(fadeGain);
      fadeGain.connect(panner);
      panner.connect(this.mix.input);
      // Passive analysis branch: reads the audible voice after filters, LFO and fades.
      fadeGain.connect(waveformAnalyser);
      this.oscillators.set(oscillatorSettings.id, {source, filter, secondFilter, cutoffControl, dryGain, wetGain, gain, volumeControl, fadeGain, panner, amplitudeGain, amplitudeControl, modulationVolume, bipolarLevel, modulationLevel, modulationWaveform, waveformAnalyser, settings: oscillatorSettings, amplitudeModulated: false});
    }
    this.setOscillatorModulations(settings.oscillatorModulations ?? []);
  }
  start(): void {
    if (this.disposed || this.stopped) throw new Error('Cannot restart a stopped drone.');
    if (this.started) return;
    this.started = true;
    this.pitchBend.start();
    const now = this.context.currentTime;
    for (const oscillator of this.oscillators.values()) {
      oscillator.source.start(now);
      oscillator.amplitudeControl.start(now);
      oscillator.volumeControl.start(now);
      oscillator.cutoffControl.start(now);
      if (oscillator.settings.enabled) {
        fadeGain(oscillator.fadeGain.gain, 1, now);
        fadeGain(oscillator.modulationLevel.gain, 1, now);
        fadeGain(oscillator.modulationWaveform.gain, 1, now);
      }
    }
    this.mix.update(this.mixSettings, now);
  }
  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (!this.started || this.stopped || this.disposed) return Promise.resolve();
    this.stopped = true;
    const now = this.context.currentTime;
    if (this.context.state !== 'running') {
      this.mix.stop(now, now);
      for (const {source, amplitudeControl, volumeControl, cutoffControl} of this.oscillators.values()) {
        source.stop(now);
        amplitudeControl.stop(now);
        volumeControl.stop(now);
        cutoffControl.stop(now);
      }
      return Promise.resolve();
    }
    const firstSource = this.oscillators.values().next().value?.source.activeClock;
    if (!firstSource) return Promise.resolve();
    const end = now + PLAYBACK_FADE_SECONDS;
    this.stopPromise = new Promise(resolve => {
      const finish = () => {
        firstSource.removeEventListener('ended', finish);
        this.context.removeEventListener('statechange', handleStateChange);
        this.finishStop = null;
        resolve();
      };
      const handleStateChange = () => {
        if (this.context.state !== 'running') finish();
      };
      this.finishStop = finish;
      this.context.addEventListener('statechange', handleStateChange);
      firstSource.addEventListener('ended', finish);
      this.mix.stop(now, end);
      for (const oscillator of this.oscillators.values()) {
        fadeGain(oscillator.fadeGain.gain, 0, now);
        fadeGain(oscillator.modulationLevel.gain, 0, now);
        fadeGain(oscillator.modulationWaveform.gain, 0, now);
        oscillator.source.stop(end);
        oscillator.amplitudeControl.stop(end);
        oscillator.volumeControl.stop(end);
        oscillator.cutoffControl.stop(end);
      }
    });
    return this.stopPromise;
  }
  fadeSources(start: number, end: number): void {
    this.mix.fadeSources(start, end);
  }

  setGain(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Gain must be between 0 and 1.');
    this.output.gain.setTargetAtTime(value * MONO_PAN_GAIN_COMPENSATION, this.context.currentTime, 0.015);
  }
  updateOscillator(settings: OscillatorSettings): void {
    if (!Number.isFinite(settings.frequencyHz) || settings.frequencyHz < 20 || settings.frequencyHz > 20000 || !Number.isFinite(settings.detuneCents) || Math.abs(settings.detuneCents) > 2400) throw new Error('Invalid oscillator settings.');
    validateLowPassFilterSettings(settings.filter);
    const oscillator = this.oscillators.get(settings.id);
    if (!oscillator) throw new Error('Unknown oscillator.');
    const now = this.context.currentTime;
    oscillator.source.update(settings, now);
    oscillator.source.detune.setTargetAtTime(settings.detuneCents, now, 0.015);
    oscillator.panner.pan.setTargetAtTime(settings.pan, now, 0.015);
    oscillator.volumeControl.offset.setTargetAtTime(this.oscillatorVolumeScale * settings.volume, now, 0.015);
    oscillator.modulationVolume.gain.setTargetAtTime(settings.volume * (oscillator.amplitudeModulated ? 1 : 2), now, 0.015);
    if (oscillator.settings.enabled !== settings.enabled) {
      if (this.started && !this.stopped) {
        fadeGain(oscillator.fadeGain.gain, settings.enabled ? 1 : 0, now);
        fadeGain(oscillator.modulationLevel.gain, settings.enabled ? 1 : 0, now);
        fadeGain(oscillator.modulationWaveform.gain, settings.enabled ? 1 : 0, now);
      }
    }
    oscillator.cutoffControl.offset.setTargetAtTime(settings.filter.cutoffHz, now, 0.02);
    oscillator.filter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    oscillator.secondFilter.Q.setTargetAtTime(mapResonanceToStageQ(settings.filter.resonance), now, 0.02);
    // Short crossfade avoids discontinuities when switching filter bypass.
    oscillator.dryGain.gain.setTargetAtTime(settings.filter.enabled ? 0 : 1, now, 0.015);
    oscillator.wetGain.gain.setTargetAtTime(settings.filter.enabled ? 1 : 0, now, 0.015);
    oscillator.settings = settings;
    for (const route of this.routes) {
      if (route.enabled && route.targetId === settings.id) this.updateModulationDepth(route);
    }
  }
  setOscillatorModulations(routes: readonly OscillatorModulationRoute[]): void {
    const enabled = new Map(routes.filter(route => route.enabled).map(route => [this.routeKey(route), route]));

    const hasNewWaveformPitchEdge = [...enabled].some(([key, route]) => {
      const previous = this.modulationRoutes.get(key)?.route;
      return usesWaveformFrequency(route) && (previous?.sourceId !== route.sourceId || previous.signal !== route.signal);
    });
    for (const node of this.fadingRoutes) {
      if (enabled.has(this.routeKey(node.route)) || (hasNewWaveformPitchEdge && usesWaveformFrequency(node.route))) {
        this.disposeFadingRoute(node);
      }
    }
    for (const [key, node] of this.modulationRoutes) {
      const replacement = enabled.get(key);
      if (replacement?.sourceId === node.route.sourceId &&
          (replacement.signal ?? 'level') === (node.route.signal ?? 'level')) continue;
      this.modulationRoutes.delete(key);
      // Disconnect old waveform pitch edges before installing new ones so an acyclic
      // replacement never creates a transient cycle with an outgoing edge.
      if (replacement || !this.started || (hasNewWaveformPitchEdge && usesWaveformFrequency(node.route))) {
        node.dispose();
      } else {
        this.fadingRoutes.add(node);
        node.fadeOut(() => this.disposeFadingRoute(node));
      }
    }
    this.routes = routes;
    for (const [key, route] of enabled) {
      if (!this.modulationRoutes.has(key)) {
        const source = this.oscillators.get(route.sourceId);
        const target = this.oscillators.get(route.targetId);
        if (!source || !target) throw new Error('Unknown oscillator modulation source or target.');
        const destinations = route.parameter === 'frequency' ? [target.source.frequency] :
          route.parameter === 'volume' ? [target.volumeControl.offset] : [target.cutoffControl.offset];
        this.modulationRoutes.set(key, new WebAudioOscillatorModulation(this.context, route,
          route.signal === 'waveform' ? source.modulationWaveform : source.modulationLevel, destinations,
          route.parameter === 'volume' ? this.oscillatorVolumeScale : 1));
      }
      this.updateModulationDepth(route);
    }
  }

  private routeKey(route: OscillatorModulationRoute): string {
    return `${route.targetId}:${route.parameter}`;
  }

  private disposeFadingRoute(node: WebAudioOscillatorModulation): void {
    node.dispose();
    this.fadingRoutes.delete(node);
  }

  private updateModulationDepth(route: OscillatorModulationRoute): void {
    const target = this.oscillators.get(route.targetId);
    if (!target) return;
    const {base, lower, upper} = getOscillatorModulationRange(target.settings, route.parameter, route.depth, this.context.sampleRate);
    this.modulationRoutes.get(this.routeKey(route))?.update(base - lower, upper - base);
  }

  setMix(settings: DroneMixSettings): void {
    this.mixSettings = settings;
    if (this.started && !this.stopped) this.mix.update(settings, this.context.currentTime);
  }
  getWaveformAnalyser(oscillatorId: string): AnalyserNode | null {
    return this.oscillators.get(oscillatorId)?.waveformAnalyser ?? null;
  }
  getOscillatorModulationAnalyser(targetId: string, parameter: OscillatorModulationParameter): AnalyserNode | null {
    return this.modulationRoutes.get(`${targetId}:${parameter}`)?.analyser ?? null;
  }
  setAmplitudeModulationEnabled(oscillatorId: string, enabled: boolean): void {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator || oscillator.amplitudeModulated === enabled) return;
    oscillator.amplitudeModulated = enabled;
    // The audible amplitude stage rests at 0.5 with no LFO. Normalize that state to full source volume.
    const scaledVolume = oscillator.settings.volume * (enabled ? 1 : 2);
    if (this.started) oscillator.modulationVolume.gain.setTargetAtTime(scaledVolume, this.context.currentTime, 0.015);
    else oscillator.modulationVolume.gain.value = scaledVolume;
  }

  getAmplitudeParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.amplitudeControl.offset;
  }
  getShapeParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.source.shape;
  }

  readOscillatorShape(oscillatorId: string): number | null {
    return this.oscillators.get(oscillatorId)?.source.readEffectiveShape() ?? null;
  }

  readOscillatorFrequency(oscillatorId: string): number | null {
    return this.oscillators.get(oscillatorId)?.source.readEffectiveFrequency() ?? null;
  }

  readOscillatorVolume(oscillatorId: string): number | null {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator || !this.started || this.stopped || this.context.state !== 'running') return null;
    if (!oscillator.volumePreview) {
      const product = this.context.createGain();
      product.gain.value = 0;
      const analyser = this.context.createAnalyser();
      const samples = new Float32Array(32);
      analyser.fftSize = samples.length;
      // Mirror the two gain stages without tapping the waveform, fades or output mix.
      oscillator.amplitudeControl.connect(product.gain);
      oscillator.volumeControl.connect(product).connect(analyser);
      oscillator.volumePreview = {product, analyser, samples};
      return null;
    }
    const {analyser, samples} = oscillator.volumePreview;
    analyser.getFloatTimeDomainData(samples);
    return samples[samples.length - 1] / this.oscillatorVolumeScale;
  }

  readOscillatorCutoff(oscillatorId: string): number | null {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator || !this.started || this.stopped || this.context.state !== 'running') return null;
    if (!oscillator.cutoffPreview) {
      const analyser = this.context.createAnalyser();
      const samples = new Float32Array(32);
      analyser.fftSize = samples.length;
      oscillator.cutoffControl.connect(analyser);
      oscillator.cutoffPreview = {analyser, samples};
      return null;
    }
    const {analyser, samples} = oscillator.cutoffPreview;
    analyser.getFloatTimeDomainData(samples);
    const cutoffHz = samples[samples.length - 1];
    return cutoffHz > 0 ? Math.min(cutoffHz, this.context.sampleRate / 2) : null;
  }

  getDetuneParameter(oscillatorId: string): AudioParam {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return oscillator.source.detune;
  }
  getFilterCutoffParameters(oscillatorId: string): readonly AudioParam[] {
    const oscillator = this.oscillators.get(oscillatorId);
    if (!oscillator) throw new Error('Unknown oscillator.');
    return [oscillator.cutoffControl.offset];
  }
  setPitchBend(cents: number): void {
    if (this.started) this.pitchBend.offset.setTargetAtTime(cents, this.context.currentTime, 0.008);
    else this.pitchBend.offset.value = cents;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.finishStop?.();
    if (this.started) this.pitchBend.stop();
    this.pitchBend.disconnect();
    for (const node of this.modulationRoutes.values()) node.dispose();
    for (const node of this.fadingRoutes) this.disposeFadingRoute(node);
    this.modulationRoutes.clear();
    for (const {source, filter, secondFilter, cutoffControl, dryGain, wetGain, gain, volumeControl, fadeGain, panner, amplitudeGain, amplitudeControl, modulationVolume, bipolarLevel, modulationLevel, modulationWaveform, waveformAnalyser, volumePreview} of this.oscillators.values()) {
      if (this.started && !this.stopped) {
        amplitudeControl.stop();
        volumeControl.stop();
        cutoffControl.stop();
      }
      volumeControl.disconnect();
      cutoffControl.disconnect();
      volumePreview?.product.disconnect();
      amplitudeControl.disconnect();
      modulationVolume.disconnect();
      bipolarLevel.disconnect();
      modulationLevel.disconnect();
      modulationWaveform.disconnect();
      source.dispose(); filter.disconnect(); secondFilter.disconnect(); dryGain.disconnect(); wetGain.disconnect(); gain.disconnect(); fadeGain.disconnect(); amplitudeGain.disconnect(); panner.disconnect(); waveformAnalyser.disconnect();
    }
    this.oscillators.clear();
    this.mix.dispose();
    this.output.disconnect();
  }
}
