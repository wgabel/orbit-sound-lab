import { DEFAULT_CYCLE_ENVELOPE } from '../domain/cycle-envelope';
import { CycleEnvelopeControls } from './CycleEnvelopeControls';
import { builtInOscillatorBanks, loadBuiltInOscillatorBank } from '../domain/built-in-oscillator-banks';
import { listOscillatorPresets, saveOscillatorPreset } from '../infrastructure/storage/oscillator-preset-library';
import { OscillatorPresetPicker } from './OscillatorPresetPicker';
import { usePresetCollection } from './usePresetCollection';
import { OscillatorBankPicker } from './OscillatorBankPicker';
import { OscillatorControlSection } from './OscillatorControlSection';
import { OscillatorLfoControls } from './OscillatorLfoControls';
import { OscillatorShapeControls } from './OscillatorShapeControls';
import { replaceOscillatorModulationRoute, validateOscillatorModulationRoutes } from '../domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute } from '../domain/oscillator-modulation';
import { OscillatorModulationSlider } from './OscillatorModulationSlider';
import { MAX_MORPH_DURATION_SECONDS, MIN_MORPH_DURATION_SECONDS } from '../domain/morph-automation';
import type { MorphAutomationSettings } from '../domain/morph-automation';
import { NEUTRAL_PERFORMANCE_POSITION } from '../domain/performance-pad';
import { PerformancePad } from './PerformancePad';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import type { SoundLabController } from '../application/audio-contracts';
import { applyPitchOffset } from '../domain/modulation';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { DEFAULT_OSCILLATOR_SHAPE, MAX_DRONE_KEY_GAIN, readDroneKeyGain, supportsOscillatorShape } from '../domain/drone';
import type { DroneMixSettings, DroneSettings, OscillatorSettings } from '../domain/drone';
import { DRONE_LAYER_IDS, createDefaultDroneLayer } from '../domain/drone-layers';
import type { DroneLayer, DroneLayerId } from '../domain/drone-layers';
import { randomizeOscillatorSettings } from '../domain/randomize-oscillator-settings';
import type { OscillatorRandomizationMode } from '../domain/randomize-oscillator-settings';
import { retargetOscillatorSnapshot } from '../domain/oscillator-clipboard';
import type { OscillatorSnapshot } from '../domain/oscillator-clipboard';
import { applyInitialSynthesizerSettings } from '../application/apply-initial-synthesizer-settings';
import { createSynthesizer } from '../composition/create-synthesizer';
import type { DroneEnvelope } from '../domain/drone-envelope';
import { DroneKeyControls } from './DroneKeyControls';
import { DroneMixControls } from './DroneMixControls';
import { NumericSlider } from './NumericSlider';
import { OscillatorPanControl } from './OscillatorPanControl';
import { useRenderingActivityDiagnostic } from './use-rendering-activity-diagnostic';
import { createDroneSnapshotName, createPreset, deletePreset, DRONE_PRESET_NAME_LIMIT, exportPreset, importPreset, listPresets, loadPresetSound, savePreset } from '../domain/preset-library';
import type { SoundPreset } from '../domain/preset-library';
import { sceneFromPreset, tuneSceneLayer } from '../domain/sound-scene';
import type { ArrangementScene, SoundScene } from '../domain/sound-scene';
import { SceneTimeline } from './SceneTimeline';
import { OscillatorStepSequencer } from './OscillatorStepSequencer';
import { applyStepValues } from '../domain/oscillator-step-sequence';
import type { StepValue } from '../domain/oscillator-step-sequence';
import { getEffectiveOscillatorFrequency } from '../domain/harmony';
import type { HarmonySettings } from '../domain/harmony';
import { AudioWaveform } from './AudioWaveform';
import './styles.css';
import { createPatchPlayback } from '../composition/create-patch-playback';
import { PatchEditor } from './patch-editor/PatchEditor';
import { readPatchDroneLayer } from '../domain/patch';
import type { PatchDrone } from '../domain/patch';

interface PatchDroneEdit {
  readonly layer: DroneLayer;
  readonly holdMode: boolean;
  applyEdits(layer: DroneLayer): boolean;
}

export function App() {
  const controller = useRef<SoundLabController | null>(null);
  const [showPatchEditor, setShowPatchEditor] = useState(false);
  const [selectedLayer, setActiveLayer] = useState<DroneLayerId>('A');
  const [mainLayers, setMainLayers] = useState<Record<DroneLayerId, DroneLayer>>(() =>
    ({A: createDefaultDroneLayer('A'), B: createDefaultDroneLayer('B')}));
  const [mainHoldModes, setMainHoldModes] = useState({A:false,B:false});
  const [patchDroneEdit, setPatchDroneEdit] = useState<PatchDroneEdit | null>(null);
  const activeLayer = patchDroneEdit ? 'A' : selectedLayer;
  const layers = patchDroneEdit ? {A:patchDroneEdit.layer,B:{...mainLayers.B,enabled:false}} : mainLayers;
  const holdModes = patchDroneEdit ? {A:patchDroneEdit.holdMode,B:false} : mainHoldModes;
  const [masterGain, setMasterGain] = useState(1);
  const performancePosition = useRef(NEUTRAL_PERFORMANCE_POSITION);
  const [playing, setPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState<'morph' | 'arrangement' | null>(null);
  const previewSession = useRef<{kind: 'morph' | 'arrangement'} | null>(null);
  const [sceneIndex, setSceneIndex] = useState<number | null>(null);
  const playingOutput = playing || previewMode !== null;
  const {drone: settings, modulation: lowFrequencyOscillatorSettings, harmony, enabled: layerEnabled} = layers[activeLayer];
  const getWaveformAnalyser = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].getWaveformAnalyser(oscillatorId) ?? null, [activeLayer]);

  const getOscillatorModulationAnalyser = useCallback((targetId: string, parameter: OscillatorModulationParameter) =>
    controller.current?.layers[activeLayer].getOscillatorModulationAnalyser(targetId, parameter) ?? null, [activeLayer]);

  const readOscillatorShape = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorShape(oscillatorId) ?? null, [activeLayer]);

  const readOscillatorFrequency = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorFrequency(oscillatorId) ?? null, [activeLayer]);

  const readOscillatorVolume = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorVolume(oscillatorId) ?? null, [activeLayer]);

  const readOscillatorCutoff = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorCutoff(oscillatorId) ?? null, [activeLayer]);

  function updateLayer(id: DroneLayerId, update: (layer: DroneLayer) => DroneLayer) {
    if (patchDroneEdit) {
      if (id === 'A') setPatchDroneEdit(current => current && {...current,layer:update(current.layer)});
      return;
    }
    setMainLayers(previous => ({...previous,[id]:update(previous[id])}));
  }

  function updateActiveLayer(update: (layer: DroneLayer) => DroneLayer) {
    updateLayer(activeLayer,update);
  }
  function applyLayer(id: DroneLayerId, layer: DroneLayer) {
    const engine = controller.current?.layers[id];
    if (!engine) return;
    engine.setOscillatorModulations(layer.drone.oscillatorModulations ?? []);
    applyInitialSynthesizerSettings(engine, tuneSceneLayer(layer), layer.modulation);
    controller.current?.setLayerLevels(id, layer.drone);
    controller.current?.setLayerEnvelope(id, layer.drone.envelope);
  }
  function applyLayersEnabled(next: Record<DroneLayerId, DroneLayer>) {
    void controller.current?.setLayersEnabled({A: next.A.enabled, B: next.B.enabled}).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Cannot change drone playback.');
    });
  }
  function updateLayerEnabled(id: DroneLayerId, enabled: boolean) {
    const next = {...layers, [id]: {...layers[id], enabled}};
    setError('');
    setMainLayers(next);
    applyLayersEnabled(next);
  }
  function updateHarmony(next: HarmonySettings) {
    try {
      const engine = controller.current?.layers[activeLayer];
      for (const [index, oscillator] of settings.oscillators.entries()) {
        engine?.updateOscillator({...oscillator, frequencyHz: getEffectiveOscillatorFrequency(next, oscillator.frequencyHz, index)});
      }
      updateActiveLayer(layer => ({...layer, harmony: next}));
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update harmony.'); }
  }
  const [expandedOscillators, setExpandedOscillators] = useState<Partial<Record<DroneLayerId, string>>>({});
  const [delaySettings, setDelaySettings] = useState<DelaySettings>(createDefaultDelaySettings);
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<SoundPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const importInput = useRef<HTMLInputElement | null>(null);
  const [morphStartId, setMorphStartId] = useState('');
  const [morphEndId, setMorphEndId] = useState('');
  const [morphPosition, setMorphPosition] = useState(0);
  const [morphDuration, setMorphDuration] = useState(20);
  const [morphLoop, setMorphLoop] = useState(false);
  const [morphMotion, setMorphMotion] = useState<'idle' | 'running' | 'held' | 'complete'>('idle');
  const [morphEnabled, setMorphEnabled] = useState(false);
  const morphStart = presets.find(preset => preset.id === morphStartId);
  const morphEnd = presets.find(preset => preset.id === morphEndId);
  const canMorph = morphEnabled && morphStart && morphEnd && morphStart.id !== morphEnd.id;

  function captureSound(): SoundScene {
    return {layers, masterGain, delay: delaySettings, performancePosition: performancePosition.current};
  }

  function stopScenePlayback() {
    previewSession.current = null;
    setPreviewMode(null);
    setSceneIndex(null);
    setMorphMotion('idle');
    controller.current?.scenePlayback.stop();
  }

  function resetMorph() {
    if (previewSession.current?.kind === 'morph') stopScenePlayback();
    setMorphPosition(0);
  }

  async function previewMorph(position: number, automation?: MorphAutomationSettings) {
    if (!canMorph || previewSession.current?.kind === 'arrangement') return;
    const current = previewSession.current;
    const session = current ?? {kind: 'morph'} as const;
    setMorphPosition(position);
    setMorphMotion(automation ? 'running' : 'idle');
    setError('');
    previewSession.current = session;
    setPreviewMode(session.kind);
    try {
      const playback = ensureSynthesizer().scenePlayback;
      if (current) {
        if (automation) playback.startMorphAutomation(automation);
        else playback.setMorphPosition(position);
        return;
      }
      await playback.startMorph(sceneFromPreset(morphStart), sceneFromPreset(morphEnd), position, automation);
    } catch (reason) {
      if (previewSession.current !== session) return;
      stopScenePlayback();
      setError(reason instanceof Error ? reason.message : 'Cannot preview the preset blend.');
    }
  }

  function holdMorph() {
    const position = controller.current?.scenePlayback.pauseMorphAutomation();
    if (position != null) setMorphPosition(position);
    setMorphMotion('held');
  }

  useEffect(() => {
    if (morphMotion !== 'running') return;
    let frame: number;
    function updateProgress() {
      const playback = controller.current?.scenePlayback;
      const automation = playback?.readMorphAutomation();
      if (!automation) return;
      setMorphPosition(Math.round(automation.position * 1000) / 1000);
      if (automation.running) frame = requestAnimationFrame(updateProgress);
      else {
        playback?.pauseMorphAutomation();
        setMorphMotion('complete');
      }
    }
    frame = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(frame);
  }, [morphMotion]);

  async function playArrangement(scenes: readonly ArrangementScene[]) {
    if (previewSession.current || playbackTransition) return;
    const session = {kind: 'arrangement'} as const;
    previewSession.current = session;
    setPreviewMode(session.kind);
    try {
      setError('');
      const engine = ensureSynthesizer();
      if (engine.isPlaying) {
        await engine.stop();
        setPlaying(engine.isPlaying);
      }
      if (previewSession.current !== session) return;
      await engine.scenePlayback.playArrangement(scenes, setSceneIndex);
    } catch (reason) {
      if (previewSession.current === session) {
        setError(reason instanceof Error ? reason.message : 'Cannot play the arrangement.');
      }
    } finally {
      if (previewSession.current === session) stopScenePlayback();
    }
  }

  useEffect(() => {
    if (showPatchEditor) return;
    let active = true;
    void listPresets().then(presets => {
      if (active) setPresets(presets);
    }).catch(reason => {
      if (active) setError(String(reason));
    });
    return () => { active = false; };
  }, [showPatchEditor]);
  async function saveCurrentPreset(snapshot: boolean) {
    try {
      const name = snapshot ? createDroneSnapshotName() : presetName.trim();
      if (!name) { setError('Enter a preset name.'); return; }
      const preset = patchDroneEdit
        ? createPreset(name,layers.A.drone,layers.A.modulation,createDefaultDelaySettings(),layers.A.harmony)
        : createPreset(name,layers.A.drone,layers.A.modulation,delaySettings,layers.A.harmony,
          {firstLayerEnabled:layers.A.enabled,secondLayer:layers.B,masterGain},activeLayer);
      await savePreset(preset);
      setPresets(await listPresets());
      setPresetName('');
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot save preset.'); }
  }
  function loadPreset(preset: SoundPreset) {
    try {
      const next = loadPresetSound(preset, layers[activeLayer]);
      applyLayer(activeLayer, next);
      updateActiveLayer(() => next);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot load preset.'); }
  }
  async function removePreset(preset: SoundPreset) {
    try {
      if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
      await deletePreset(preset.id);
      if (preset.id === morphStartId || preset.id === morphEndId) resetMorph();
      setPresets(await listPresets());
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot delete preset.'); }
  }
  async function handlePresetImport(file: File) {
    try {
      await importPreset(file);
      setPresets(await listPresets());
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot import preset.'); }
  }
  const [renderingDiagnosticEnabled, setRenderingDiagnosticEnabled] = useState(false);
  const renderingIndicator = useRenderingActivityDiagnostic(renderingDiagnosticEnabled && playing);
  useEffect(() => () => { controller.current?.dispose(); controller.current = null; }, []);
  const [playbackTransition, setPlaybackTransition] = useState(false);
  function ensureSynthesizer(): SoundLabController {
    if (controller.current) return controller.current;
    const engine = createSynthesizer();
    controller.current = engine;
    for (const id of DRONE_LAYER_IDS) {
      applyLayer(id, layers[id]);
      void engine.setLayerHoldMode(id, holdModes[id]);
    }
    engine.setMasterGain(patchDroneEdit ? 1 : masterGain);
    engine.setPerformancePosition(patchDroneEdit ? NEUTRAL_PERFORMANCE_POSITION : performancePosition.current);
    engine.updateDelay(patchDroneEdit ? createDefaultDelaySettings() : delaySettings);
    applyLayersEnabled(layers);
    return engine;
  }

  function updateHoldMode(id: DroneLayerId, holding: boolean) {
    if (patchDroneEdit) setPatchDroneEdit(current => current && {...current,holdMode:holding});
    else setMainHoldModes(previous => ({...previous,[id]:holding}));
    void controller.current?.setLayerHoldMode(id, holding).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Cannot change drone key mode.');
    });
  }

  function updateLayerEnvelope(id: DroneLayerId, envelope: DroneEnvelope) {
    controller.current?.setLayerEnvelope(id, envelope);
    updateLayer(id,layer => ({...layer,drone:{...layer.drone,envelope}}));
  }

  async function pressLayerKey(id: DroneLayerId) {
    try {
      setError('');
      const engine = ensureSynthesizer();
      updateHoldMode(id, true);
      const startKey = engine.pressLayerKey(id);
      setPlaying(engine.isPlaying);
      await startKey;
    } catch (reason) {
      setPlaying(controller.current?.isPlaying ?? false);
      setError(reason instanceof Error ? reason.message : 'Cannot play drone key.');
    }
  }

  async function togglePlayback() {
    if (playbackTransition) return;
    setPlaybackTransition(true);
    try {
      setError('');
      const engine = ensureSynthesizer();
      if (previewSession.current) {
        stopScenePlayback();
        if (engine.isPlaying) await engine.stop();
      } else if (engine.isPlaying) {
        await engine.stop();
      } else {
        await engine.setLayersEnabled({
          A: layers.A.enabled || (activeLayer === 'A' && !holdModes.A),
          B: layers.B.enabled || (activeLayer === 'B' && !holdModes.B)
        });
        await engine.start();
        if (!holdModes[activeLayer]) updateActiveLayer(layer => ({...layer, enabled: true}));
      }
      setPlaying(engine.isPlaying);
    } catch (reason) {
      setPlaying(controller.current?.isPlaying ?? false);
      setError(reason instanceof Error ? reason.message : 'Cannot change playback.');
    } finally {
      setPlaybackTransition(false);
    }
  }
  function applyOscillatorStep(id: DroneLayerId, drone: DroneSettings, values: readonly StepValue[]): DroneSettings {
    const next = applyStepValues(drone, values);
    if (next === drone) return drone;
    const engine = controller.current?.layers[id];
    if (engine) {
      for (const [index, oscillator] of next.oscillators.entries()) {
        if (oscillator === drone.oscillators[index]) continue;
        engine.updateOscillator({...oscillator,
          frequencyHz: getEffectiveOscillatorFrequency(layers[id].harmony, oscillator.frequencyHz, index)});
      }
      if (next.oscillatorModulations?.some((route, index) => route !== drone.oscillatorModulations?.[index])) {
        engine.setOscillatorModulations(next.oscillatorModulations);
      }
    }
    updateLayer(id,layer => ({...layer,drone:next}));
    return next;
  }
  function updateOscillator(oscillator: OscillatorSettings) {
    try {
      controller.current?.layers[activeLayer].updateOscillator({...oscillator,
        frequencyHz: getEffectiveOscillatorFrequency(harmony, oscillator.frequencyHz, settings.oscillators.findIndex(item => item.id === oscillator.id))});
      updateActiveLayer(layer => ({...layer, drone: {...layer.drone,
        oscillators: layer.drone.oscillators.map(item => item.id === oscillator.id ? oscillator : item)}}));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update oscillator.'); }
  }
  function updateOscillatorModulation(route: OscillatorModulationRoute) {
    try {
      const oscillatorModulations = replaceOscillatorModulationRoute(settings.oscillatorModulations ?? [], route);
      validateOscillatorModulationRoutes(oscillatorModulations, settings.oscillators);
      controller.current?.layers[activeLayer].setOscillatorModulations(oscillatorModulations);
      updateActiveLayer(layer => ({...layer, drone: {...layer.drone, oscillatorModulations}}));
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update oscillator modulation.'); }
  }

  function renderOscillatorModulationSlider(oscillator: OscillatorSettings, index: number, parameter: OscillatorModulationParameter) {
    const pitchLfo = parameter === 'frequency' ? lowFrequencyOscillatorSettings.find(modulation =>
      modulation.targetOscillatorId === oscillator.id && modulation.destination === 'pitch' && modulation.enabled) : undefined;
    const amplitudeLfo = parameter === 'volume' ? lowFrequencyOscillatorSettings.find(modulation =>
      modulation.targetOscillatorId === oscillator.id && modulation.destination === 'amplitude' && modulation.enabled) : undefined;
    const cutoffLfo = parameter === 'cutoff' ? lowFrequencyOscillatorSettings.find(modulation =>
      modulation.targetOscillatorId === oscillator.id && modulation.destination === 'filterCutoff' && modulation.enabled) : undefined;
    return <OscillatorModulationSlider oscillator={oscillator} oscillators={settings.oscillators}
      effectiveFrequency={getEffectiveOscillatorFrequency(harmony, oscillator.frequencyHz, index)}
      parameter={parameter} routes={settings.oscillatorModulations ?? []} sampleRate={controller.current?.layers[activeLayer].sampleRate}
      cutoffDepthHz={cutoffLfo?.depthHz} readOscillatorCutoff={readOscillatorCutoff}
      amplitudeDepth={amplitudeLfo?.depthAmplitude} readOscillatorVolume={readOscillatorVolume}
      pitchDepthCents={pitchLfo?.depthCents} readOscillatorFrequency={readOscillatorFrequency}
      playing={playing} getModulationAnalyser={getOscillatorModulationAnalyser}
      disabled={parameter === 'cutoff' && !oscillator.filter.enabled} onRouteChange={updateOscillatorModulation}
      onChange={value => updateOscillator(parameter === 'cutoff' ? {...oscillator, filter: {...oscillator.filter, cutoffHz: value}} :
        parameter === 'frequency' ? {...oscillator, frequencyHz: value} : {...oscillator, volume: value})}/>;
  }

  function renderOscillatorLfo(oscillatorId: string, destination: LowFrequencyOscillatorSettings['destination']) {
    const modulation = lowFrequencyOscillatorSettings.find(item =>
      item.targetOscillatorId === oscillatorId && item.destination === destination);
    return modulation && <OscillatorLfoControls modulation={modulation} onChange={updateLowFrequencyOscillator}/>;
  }

  function updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings) {
    try {
      controller.current?.layers[activeLayer].updateLowFrequencyOscillator(settings);
      updateActiveLayer(layer => ({...layer, modulation: layer.modulation.map(item =>
        item.targetOscillatorId === settings.targetOscillatorId && item.destination === settings.destination ? settings : item)}));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update LFO.'); }
  }
  const [oscillatorClipboard, setOscillatorClipboard] = useState<OscillatorSnapshot | null>(null);
  const [oscillatorActionStatus, setOscillatorActionStatus] = useState('');
  const oscillatorPresets = usePresetCollection(listOscillatorPresets);
  function applyOscillatorSnapshot({oscillator, modulations}: OscillatorSnapshot) {
    const engine = controller.current?.layers[activeLayer];
    engine?.updateOscillator({...oscillator,
      frequencyHz: getEffectiveOscillatorFrequency(harmony, oscillator.frequencyHz, settings.oscillators.findIndex(item => item.id === oscillator.id))});
    for (const modulation of modulations) engine?.updateLowFrequencyOscillator(modulation);
    updateActiveLayer(layer => ({...layer,
      drone: {...layer.drone, oscillators: layer.drone.oscillators.map(item => item.id === oscillator.id ? oscillator : item)},
      modulation: layer.modulation.map(item => modulations.find(modulation =>
        modulation.targetOscillatorId === item.targetOscillatorId && modulation.destination === item.destination) ?? item)
    }));
    setError('');
  }
  function randomizeOscillator(oscillator: OscillatorSettings, mode: OscillatorRandomizationMode) {
    const modulations = lowFrequencyOscillatorSettings.filter(item => item.targetOscillatorId === oscillator.id);
    try {
      applyOscillatorSnapshot(randomizeOscillatorSettings(oscillator, modulations, mode));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot randomize oscillator.'); }
  }
  function loadOscillatorBank(presetId: string) {
    const preset = builtInOscillatorBanks.find(item => item.id === presetId);
    if (!preset) return;
    try {
      const layer = loadBuiltInOscillatorBank(preset.id, layers[activeLayer]);
      applyLayer(activeLayer, layer);
      updateActiveLayer(() => layer);
      setOscillatorActionStatus(`${preset.name} loaded into Drone ${activeLayer}`);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot load oscillator bank.'); }
  }

  function describeOscillator(number: number): string {
    return `${patchDroneEdit ? 'Patch drone' : `Drone ${activeLayer}`} · Oscillator ${number}`;
  }
  function loadOscillatorPreset(snapshot: OscillatorSnapshot, name: string, number: number) {
    try {
      applyOscillatorSnapshot(snapshot);
      setOscillatorActionStatus(`${name} loaded into ${describeOscillator(number)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot load oscillator preset.'); }
  }
  async function saveCustomOscillatorPreset(name: string, snapshot: OscillatorSnapshot): Promise<boolean> {
    const saved = await oscillatorPresets.update(() => saveOscillatorPreset(name,snapshot));
    if (saved) setOscillatorActionStatus(`${name} saved to Custom presets`);
    return saved;
  }
  function captureOscillator(oscillator: OscillatorSettings): OscillatorSnapshot {
    return {oscillator,modulations:lowFrequencyOscillatorSettings.filter(item => item.targetOscillatorId === oscillator.id)};
  }
  function copyOscillator(oscillator: OscillatorSettings, number: number) {
    setOscillatorClipboard(captureOscillator(oscillator));
    setOscillatorActionStatus(`${describeOscillator(number)} copied`);
  }
  function pasteOscillator(oscillator: OscillatorSettings, number: number) {
    if (!oscillatorClipboard) return;
    try {
      applyOscillatorSnapshot(retargetOscillatorSnapshot(oscillatorClipboard, oscillator));
      setOscillatorActionStatus(`${describeOscillator(number)} pasted`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot paste oscillator settings.'); }
  }
  function updateDelay(next: DelaySettings) {
    try { controller.current?.updateDelay(next); setDelaySettings(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update delay.'); }
  }
  function updateDroneMix(mix: DroneMixSettings) {
    try {
      controller.current?.layers[activeLayer].setMix(mix);
      updateActiveLayer(layer => ({...layer, drone: {...layer.drone, mix}}));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update drone mix.'); }
  }
  function updateLayerKeyGain(id: DroneLayerId, keyGain: number) {
    const gain = layers[id].drone.gain;
    controller.current?.setLayerLevels(id,{gain,keyGain});
    updateLayer(id,layer => ({...layer,drone:{...layer.drone,keyGain}}));
  }
  function updatePatchDroneGain(id: DroneLayerId, gain: number) {
    const keyGain = readDroneKeyGain(layers[id].drone);
    controller.current?.setLayerLevels(id,{gain,keyGain});
    updateLayer(id,layer => ({...layer,drone:{...layer.drone,gain,keyGain}}));
  }
  function openPatchDrone(module: PatchDrone, applyEdits: PatchDroneEdit['applyEdits']) {
    controller.current?.dispose();
    controller.current = null;
    setError('');
    setPatchDroneEdit({layer:structuredClone(readPatchDroneLayer(module)),holdMode:false,applyEdits});
    setShowPatchEditor(false);
    window.scrollTo(0,0);
  }

  async function returnToPatch() {
    if (!patchDroneEdit || playbackTransition) return;
    setPlaybackTransition(true);
    setError('');
    try {
      const engine = controller.current;
      if (engine?.isPlaying) await engine.stop();
      setPlaying(false);
      if (!patchDroneEdit.applyEdits(patchDroneEdit.layer)) throw new Error('Could not apply changes to the drone node.');
      engine?.dispose();
      controller.current = null;
      setPatchDroneEdit(null);
      setShowPatchEditor(true);
      window.scrollTo(0,0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not return to the patch editor.');
    } finally {
      setPlaybackTransition(false);
    }
  }

  return <>
    <PatchEditor hidden={!showPatchEditor} droneLayers={mainLayers} onClose={() => setShowPatchEditor(false)}
      onEditDrone={openPatchDrone} createPlayback={createPatchPlayback}/>
    <main className="instrument" hidden={showPatchEditor} inert={Boolean(patchDroneEdit) && playbackTransition}>
    <section className="master" aria-label="Playback">
      <h1>Orbit <span>Sound Lab</span></h1>
      <button type="button" className={playingOutput ? 'playing' : ''} disabled={playbackTransition}
        onClick={() => void togglePlayback()}>{previewMode ? '■ Stop playback' : playing ? '■ Stop drones' : '▶ Start drones'}</button>
      {!patchDroneEdit && <NumericSlider label="MASTER LEVEL" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        disabled={previewMode !== null} value={masterGain} onChange={gain => {controller.current?.setMasterGain(gain); setMasterGain(gain);}}/>}
    </section>
    {patchDroneEdit ? <button type="button" className="patch-entry" disabled={playbackTransition}
      onClick={() => void returnToPatch()}>Apply edits and return to patch</button> :
      <button type="button" className="patch-entry" disabled={playingOutput || playbackTransition}
        onClick={() => setShowPatchEditor(true)}>Open patch editor</button>}
    {error && <p role="alert" className="error">{error}</p>}
    {!patchDroneEdit && <section className="drone-picker" aria-label="Drone layers">
      {DRONE_LAYER_IDS.map(id => <div key={id} className="drone-layer-choice" data-layer={id}>
        <button type="button" aria-pressed={activeLayer === id} onClick={() => setActiveLayer(id)}>Drone {id}</button>
        <label className="rack-switch">
          <input type="checkbox" aria-label={`Enable Drone ${id}`} disabled={playbackTransition || holdModes[id]}
            checked={layers[id].enabled && !holdModes[id]} onChange={event => updateLayerEnabled(id, event.target.checked)}/>
          <span aria-hidden="true">{holdModes[id] ? 'Key' : layers[id].enabled ? 'On' : 'Off'}</span>
        </label>
      </div>)}
    </section>}
    <section className="oscillators" data-layer={activeLayer} aria-labelledby="oscillator-rack-title">
      <div className="oscillator-rack-heading">
        <h2 id="oscillator-rack-title">{patchDroneEdit ? 'Patch drone oscillators' : `Drone ${activeLayer} oscillators`}</h2>
        <OscillatorBankPicker onLoad={loadOscillatorBank}/>
        <span className="oscillator-action-status" role="status">{oscillatorActionStatus}</span>
      </div>
      {oscillatorPresets.loadError && <p className="error" role="alert">Custom oscillator presets: {oscillatorPresets.loadError}</p>}
      {settings.oscillators.map((oscillator, index) => {
        const expanded = expandedOscillators[activeLayer] === oscillator.id;
        const settingsId = `${activeLayer}-${oscillator.id}-settings`;
        const oscillatorNumber = index + 1;
        const tunedFrequency = applyPitchOffset(getEffectiveOscillatorFrequency(harmony, oscillator.frequencyHz, index),
          oscillator.detuneCents);
        return <article key={settingsId} className="oscillator-panel" aria-label={`Oscillator ${oscillatorNumber}`}>
          <div className="oscillator-rack-row">
            <label className="rack-switch oscillator-rack-switch">
              <input type="checkbox" aria-label={`Enable oscillator ${oscillatorNumber}`} checked={oscillator.enabled}
                onChange={event => updateOscillator({...oscillator, enabled: event.target.checked})}/>
              <span aria-hidden="true">{oscillator.enabled ? 'On' : 'Off'}</span>
            </label>
            <div className="oscillator-rack-identity">
              <strong>OSC {String(oscillatorNumber).padStart(2, '0')}</strong>
              <span title="Tuned pitch before modulation">{Number(tunedFrequency.toFixed(1))} Hz</span>
            </div>
            <AudioWaveform sourceId={oscillator.id} playing={playing && (layerEnabled || holdModes[activeLayer])}
              enabled={oscillator.enabled} getAnalyser={getWaveformAnalyser}/>
            <div className="oscillator-rack-volume">
              {renderOscillatorModulationSlider(oscillator, index, 'volume')}
            </div>
            <button type="button" className="oscillator-panel-toggle" aria-expanded={expanded} aria-controls={settingsId}
              aria-label={`${expanded ? 'Hide' : 'Show'} settings for oscillator ${oscillatorNumber}`}
              onClick={() => setExpandedOscillators(previous => ({...previous, [activeLayer]: expanded ? undefined : oscillator.id}))}>
              <span className="oscillator-expand-hint">{expanded ? 'Hide' : 'Settings'}</span>
            </button>
          </div>
          <div id={settingsId} className="oscillator-controls" hidden={!expanded}>
            <div className="oscillator-editor-actions">
              <OscillatorPresetPicker oscillatorNumber={oscillatorNumber} snapshot={captureOscillator(oscillator)}
                customPresets={oscillatorPresets.presets} busy={oscillatorPresets.busy} onSave={saveCustomOscillatorPreset}
                onLoad={(snapshot,name) => loadOscillatorPreset(snapshot,name,oscillatorNumber)}/>
              <button type="button" className="randomize-button"
                onClick={() => copyOscillator(oscillator, oscillatorNumber)} aria-label={`Copy oscillator ${oscillatorNumber}`}>COPY</button>
              <button type="button" className="randomize-button" disabled={!oscillatorClipboard}
                onClick={() => pasteOscillator(oscillator, oscillatorNumber)} aria-label={`Paste into oscillator ${oscillatorNumber}`}>PASTE</button>
              <button type="button" className="randomize-button" onClick={() => randomizeOscillator(oscillator, 'random')}
                aria-label={`Randomize settings for oscillator ${oscillatorNumber}`}>⤨ RANDOM</button>
              <button type="button" className="randomize-button" onClick={() => randomizeOscillator(oscillator, 'variant')}
                aria-label={`Generate variant for oscillator ${oscillatorNumber}`} title="Vary each setting by up to 5% of its slider range">VARIANT</button>
            </div>
            <OscillatorControlSection title="Volume & Pan">
              <OscillatorPanControl oscillatorId={oscillator.id} oscillatorNumber={oscillatorNumber} pan={oscillator.pan}
                onChange={pan => updateOscillator({...oscillator, pan})}/>
              {renderOscillatorLfo(oscillator.id, 'amplitude')}
            </OscillatorControlSection>
            <OscillatorControlSection title="Frequency & Waveform">
              {renderOscillatorModulationSlider(oscillator, index, 'frequency')}
              {renderOscillatorLfo(oscillator.id, 'pitch')}
              <NumericSlider label="DETUNE" unit="cents" min={-100} max={100} step={1} value={oscillator.detuneCents}
                onChange={detuneCents => updateOscillator({...oscillator, detuneCents})}/>
              <label className="oscillator-waveform-control">WAVEFORM
                <select value={oscillator.waveform}
                  onChange={event => updateOscillator({...oscillator, waveform: event.target.value as OscillatorSettings['waveform']})}>
                  <option value="sine">Sine (diagnostic)</option>
                  <option value="triangle">Triangle</option>
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="sineTriangle">Sine ↔ Triangle</option>
                  <option value="variablePulse">Variable Pulse</option>
                  <option value="foldedSine">Folded Sine</option>
                  <option value="peakedSine">Peaked Sine</option>
                  <option value="cycleEnvelope">Cycle Envelope</option>
                </select>
              </label>
              {oscillator.waveform === 'cycleEnvelope' && <CycleEnvelopeControls envelope={oscillator.cycleEnvelope ?? DEFAULT_CYCLE_ENVELOPE}
                amount={oscillator.shape ?? DEFAULT_OSCILLATOR_SHAPE}
                onChange={cycleEnvelope => updateOscillator({...oscillator,cycleEnvelope})}/>}
              {supportsOscillatorShape(oscillator.waveform) && <OscillatorShapeControls oscillator={oscillator}
                modulation={lowFrequencyOscillatorSettings.find(item =>
                  item.targetOscillatorId === oscillator.id && item.destination === 'shape')}
                readShape={readOscillatorShape} playing={playing && (layerEnabled || holdModes[activeLayer])}
                onChange={shape => updateOscillator({...oscillator, shape})} onModulationChange={updateLowFrequencyOscillator}/>}
            </OscillatorControlSection>
            <OscillatorControlSection title="Low-pass filter" action={<label className="switch">
              <input type="checkbox" checked={oscillator.filter.enabled}
                onChange={event => updateOscillator({...oscillator, filter: {...oscillator.filter, enabled: event.target.checked}})}/>
              {' '}ACTIVE
            </label>}>
              {renderOscillatorModulationSlider(oscillator, index, 'cutoff')}
              {renderOscillatorLfo(oscillator.id, 'filterCutoff')}
              <NumericSlider label="RESONANCE" min={0.1} max={12} step={0.1}
                disabled={!oscillator.filter.enabled} value={oscillator.filter.resonance}
                onChange={resonance => updateOscillator({...oscillator, filter: {...oscillator.filter, resonance}})}/>
            </OscillatorControlSection>
          </div>
        </article>;
      })}
    </section>
    <section className="performance-controls" aria-labelledby="performance-controls-title">
      <h2 id="performance-controls-title">Performance</h2>
      <div hidden={Boolean(patchDroneEdit)}><PerformancePad onChange={position => {
        performancePosition.current = position;
        controller.current?.setPerformancePosition(position);
      }}/></div>
      <div className="drone-layers">
        {(patchDroneEdit ? [activeLayer] : DRONE_LAYER_IDS).map(id => <div key={id} className="drone-layer" data-layer={id}>
            <h3>{patchDroneEdit ? 'Patch drone' : `Drone ${id}`}</h3>
            {patchDroneEdit && <NumericSlider label="PATCH DRONE LEVEL" unit="%" displayFactor={100} min={0} max={1} step={0.01}
              value={layers[id].drone.gain} onChange={gain => updatePatchDroneGain(id, gain)}/>}
            <NumericSlider label={patchDroneEdit ? 'KEY LEVEL' : `DRONE ${id} KEY LEVEL`} unit="%" displayFactor={100}
              min={0} max={MAX_DRONE_KEY_GAIN} step={0.01}
              value={readDroneKeyGain(layers[id].drone)} onChange={gain => updateLayerKeyGain(id, gain)}/>
            <label className="switch drone-key-mode">
              <input type="checkbox" aria-label={`Key mode for Drone ${id}`} checked={holdModes[id]}
                onChange={event => updateHoldMode(id, event.target.checked)}/> KEY MODE
            </label>
            <DroneKeyControls id={id} envelope={layers[id].drone.envelope} disabled={playbackTransition || previewMode !== null}
              onEnvelopeChange={envelope => updateLayerEnvelope(id, envelope)}
              onPress={() => void pressLayerKey(id)}
              onRelease={() => controller.current?.releaseLayerKey(id)}
              onBend={cents => controller.current?.setLayerBend(id, cents)}/>

      </div>)}
      </div>
      <div hidden={Boolean(patchDroneEdit)}>{DRONE_LAYER_IDS.map(id => <OscillatorStepSequencer key={id} layerId={id} active={!patchDroneEdit && id === activeLayer}
        canPlay={!patchDroneEdit && playing && layers[id].enabled && !holdModes[id] && !previewMode && !playbackTransition} drone={layers[id].drone}
        readAudioTime={() => controller.current?.readAudioTime() ?? 0}
        applyValues={(drone, values) => applyOscillatorStep(id, drone, values)}/>)}</div>
    </section>
    <DroneMixControls key={activeLayer} layerId={activeLayer} settings={settings.mix}
      sampleRate={controller.current?.layers[activeLayer].sampleRate} onChange={updateDroneMix}/>
    <section className="harmony-engine" key={`harmony-${activeLayer}`}><h2>HARMONY ENGINE</h2><div className="harmony-modes">{(['free','natural','piano'] as const).map(mode => <button type="button" key={mode} className={harmony.mode === mode ? 'selected' : ''} aria-pressed={harmony.mode === mode} onClick={() => updateHarmony({...harmony,mode})}>{mode.toUpperCase()}</button>)}</div><div className="harmony-controls"><NumericSlider label="ROOT FREQUENCY" unit="Hz" min={55} max={220} step={1}
      value={harmony.rootFrequencyHz} onChange={value => updateHarmony({...harmony,rootFrequencyHz:value})}/><label>HARMONY<select value={harmony.chord} onChange={event => updateHarmony({...harmony,chord:event.target.value as HarmonySettings['chord']})}><option value="minor">Minor / melancholic</option><option value="major">Major / warm</option><option value="fifth">Open fifths / spacious</option><option value="ambient">Ambient / suspended</option></select></label><NumericSlider label="DETUNE / SPREAD" unit="cents" min={0} max={20} step={1}
      value={harmony.spreadCents} onChange={value => updateHarmony({...harmony,spreadCents:value})}/></div><div className="harmony-preview">{settings.oscillators.map((oscillator,index) => <span key={oscillator.id}>OSC {index+1} · {oscillator.frequencyHz.toFixed(1)} → {getEffectiveOscillatorFrequency(harmony,oscillator.frequencyHz,index).toFixed(1)} Hz</span>)}</div><p>{harmony.mode === 'free' ? 'FREE: frequency sliders and RANDOM use unrestricted frequencies.' : 'NATURAL / PIANO: RANDOM chooses a note from the selected harmony. Harmony processes the audible pitch without changing source frequencies.'}</p></section>
    {!patchDroneEdit && <section className="master-delay"><div className="oscillator-title"><strong>MASTER ECHO / DELAY</strong><label className="switch"><input type="checkbox" checked={delaySettings.enabled} onChange={event => updateDelay({...delaySettings,enabled:event.target.checked})}/> ACTIVE</label></div><div className="delay-controls"><NumericSlider label="TIME" unit="s" min={0.05} max={2} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.timeSeconds} onChange={value => updateDelay({...delaySettings,timeSeconds:value})}/><NumericSlider label="FEEDBACK" unit="%" displayFactor={100} min={0} max={0.85} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.feedback} onChange={value => updateDelay({...delaySettings,feedback:value})}/><NumericSlider label="WET MIX" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.mix} onChange={value => updateDelay({...delaySettings,mix:value})}/></div><p>Echo repeats the combined drone. Start with low feedback and mix.</p></section>}
    <section className="preset-library"><h2>PRESET LIBRARY</h2><div className="preset-actions"><input aria-label="Preset name" placeholder="Preset name" maxLength={DRONE_PRESET_NAME_LIMIT} value={presetName} onChange={event => setPresetName(event.target.value)}/><button type="button" onClick={() => void saveCurrentPreset(false)}>SAVE PRESET</button><button type="button" onClick={() => void saveCurrentPreset(true)}>SAVE SNAPSHOT</button><button type="button" onClick={() => importInput.current?.click()}>IMPORT JSON</button><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void handlePresetImport(file); event.target.value = ''; }}/></div><div className="preset-morph" hidden={Boolean(patchDroneEdit)}>
      <div className="preset-morph-heading">
        <h3>Preset Morph</h3>
        <label className="preset-morph-toggle"><input type="checkbox" checked={morphEnabled}
          disabled={previewMode === 'arrangement'}
          onChange={event => { setMorphEnabled(event.target.checked); if (!event.target.checked) resetMorph(); }}/> Enable Morph</label>
      </div>
      <fieldset className="preset-morph-content" disabled={!morphEnabled || previewMode === 'arrangement'}>
        <div className="preset-morph-selectors">
          <label>Preset A<select aria-label="Morph preset A" value={morphStartId}
            onChange={event => { setMorphStartId(event.target.value); resetMorph(); }}>
            <option value="">Select preset A</option>
            {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select></label>
          <label>Preset B<select aria-label="Morph preset B" value={morphEndId}
            onChange={event => { setMorphEndId(event.target.value); resetMorph(); }}>
            <option value="">Select preset B</option>
            {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select></label>
        </div>
        <NumericSlider label="Morph position" className="preset-morph-slider" unit="%" displayFactor={100} min={0} max={1} step={0.001}
          value={morphPosition} disabled={!canMorph || playbackTransition} onChange={position => void previewMorph(position)}/>
        <div className="preset-morph-automation">
          <NumericSlider label="Travel time" unit="s" scale="logarithmic" min={MIN_MORPH_DURATION_SECONDS} max={MAX_MORPH_DURATION_SECONDS} step={0.5}
            value={morphDuration} disabled={!canMorph || morphMotion === 'running'}
            onChange={setMorphDuration}/>
          <label className="preset-morph-toggle"><input type="checkbox" checked={morphLoop}
            disabled={!canMorph || morphMotion === 'running'}
            onChange={event => setMorphLoop(event.target.checked)}/> Loop back and forth</label>
        </div>
        <div className="preset-morph-actions">
          {previewMode !== 'morph' && <button type="button" disabled={!canMorph || playbackTransition}
            onClick={() => void previewMorph(morphPosition)}>Preview blend</button>}
          {morphMotion === 'running' ?
            <button type="button" onClick={holdMorph}>Hold blend</button> :
            <button type="button" disabled={!canMorph || playbackTransition}
              onClick={() => void previewMorph(0, {durationSeconds: morphDuration, loop: morphLoop})}>
              {morphLoop ? 'Loop A ↔ B' : 'Play A → B'}
            </button>}
          <span role="status">{{
            idle: '', running: morphLoop ? 'Looping' : 'Playing A → B', held: 'Blend held', complete: 'At preset B'
          }[morphMotion]}</span>
        </div>
        <p>Travel time is for one direction. Move the slider to take over the blend, or turn Morph off to return to the editor sound.</p>
      </fieldset>
    </div>
    <div hidden={Boolean(patchDroneEdit)}><SceneTimeline captureSound={captureSound} onPlay={scenes => void playArrangement(scenes)}
      onStop={stopScenePlayback} playing={previewMode === 'arrangement'}
      blocked={previewMode === 'morph' || playbackTransition} sceneIndex={sceneIndex}/></div>
    <div className="preset-list">{presets.length === 0 ? <p>No saved presets yet. Presets stay in this browser; export JSON for backup.</p> : presets.map(preset => <div className="preset-item" key={preset.id}><div><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleString()}</small></div><div className="preset-item-actions"><button type="button" aria-label={`Load ${preset.name} into Drone ${activeLayer}`} onClick={() => loadPreset(preset)}>LOAD TO {activeLayer}</button><button type="button" onClick={() => exportPreset(preset)}>EXPORT</button><button type="button" onClick={() => void removePreset(preset)}>DELETE</button></div></div>)}</div></section>
    <section className="diagnostic"><h2>ANDROID AUDIO DIAGNOSTIC</h2><label><input type="checkbox" checked={renderingDiagnosticEnabled} onChange={event => setRenderingDiagnosticEnabled(event.target.checked)}/> Keep rendering active while playing (experiment)</label><div className="diagnostic-track"><div className="diagnostic-indicator" ref={renderingIndicator}/></div><p>Compare 30 seconds with this OFF and ON without touching the screen. This intentionally increases rendering work and battery use; it is not a permanent audio fix.</p><a href="./audio-diagnostic.html">Open standalone audio output test</a></section><footer>WEB AUDIO ENGINE · SOLAR 42 INSPIRED · USE LOW VOLUME</footer></main></>;
}
