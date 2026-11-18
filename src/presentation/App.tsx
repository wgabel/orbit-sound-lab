import { builtInOscillatorPresets, createBuiltInOscillatorSnapshot } from '../domain/built-in-oscillator-presets';
import { OscillatorControlSection } from './OscillatorControlSection';
import { OscillatorLfoControls } from './OscillatorLfoControls';
import { replaceOscillatorModulationRoute, validateOscillatorModulationRoutes } from '../domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute } from '../domain/oscillator-modulation';
import { OscillatorModulationSlider } from './OscillatorModulationSlider';
import { NEUTRAL_PERFORMANCE_POSITION } from '../domain/performance-pad';
import { PerformancePad } from './PerformancePad';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import type { SoundLabController } from '../application/audio-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneMixSettings, OscillatorSettings } from '../domain/drone';
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
import { createPreset, deletePreset, exportPreset, importPreset, listPresets, loadPresetSound, savePreset } from '../domain/preset-library';
import type { SoundPreset } from '../domain/preset-library';
import { morphPresets } from '../domain/preset-morphing';
import { getEffectiveOscillatorFrequency } from '../domain/harmony';
import type { HarmonySettings } from '../domain/harmony';
import { OscillatorWaveform } from './OscillatorWaveform';
import './styles.css';
export function App() {
  const controller = useRef<SoundLabController | null>(null);
  const [activeLayer, setActiveLayer] = useState<DroneLayerId>('A');
  const [layers, setLayers] = useState<Record<DroneLayerId, DroneLayer>>(() =>
    ({A: createDefaultDroneLayer('A'), B: createDefaultDroneLayer('B')}));
  const [holdModes, setHoldModes] = useState({A: false, B: false});
  const [masterGain, setMasterGain] = useState(1);
  const performancePosition = useRef(NEUTRAL_PERFORMANCE_POSITION);
  const [playing, setPlaying] = useState(false);
  const {drone: settings, modulation: lowFrequencyOscillatorSettings, harmony, enabled: layerEnabled} = layers[activeLayer];
  const getWaveformAnalyser = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].getWaveformAnalyser(oscillatorId) ?? null, [activeLayer]);

  const getOscillatorModulationAnalyser = useCallback((targetId: string, parameter: OscillatorModulationParameter) =>
    controller.current?.layers[activeLayer].getOscillatorModulationAnalyser(targetId, parameter) ?? null, [activeLayer]);

  const readOscillatorFrequency = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorFrequency(oscillatorId) ?? null, [activeLayer]);

  const readOscillatorVolume = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorVolume(oscillatorId) ?? null, [activeLayer]);

  const readOscillatorCutoff = useCallback((oscillatorId: string) =>
    controller.current?.layers[activeLayer].readOscillatorCutoff(oscillatorId) ?? null, [activeLayer]);

  function updateActiveLayer(update: (layer: DroneLayer) => DroneLayer) {
    setLayers(previous => ({...previous, [activeLayer]: update(previous[activeLayer])}));
  }
  function applyLayer(id: DroneLayerId, layer: DroneLayer) {
    const engine = controller.current?.layers[id];
    if (!engine) return;
    const oscillators = layer.drone.oscillators.map((oscillator, index) => ({
      ...oscillator, frequencyHz: getEffectiveOscillatorFrequency(layer.harmony, oscillator.frequencyHz, index)
    }));
    engine.setOscillatorModulations(layer.drone.oscillatorModulations ?? []);
    applyInitialSynthesizerSettings(engine, {...layer.drone, oscillators}, layer.modulation);
    controller.current?.setLayerEnvelope(id, layer.drone.envelope);
  }
  function applyLayersEnabled(next: Record<DroneLayerId, DroneLayer>) {
    void controller.current?.setLayersEnabled({A: next.A.enabled, B: next.B.enabled}).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Cannot change drone playback.');
    });
  }
  function applyScene(next: Record<DroneLayerId, DroneLayer>, gain: number, delay: DelaySettings) {
    for (const id of DRONE_LAYER_IDS) applyLayer(id, next[id]);
    controller.current?.setMasterGain(gain);
    controller.current?.updateDelay(delay);
    applyLayersEnabled(next);
    setLayers(next);
    setMasterGain(gain);
    setDelaySettings(delay);
  }
  function updateLayerEnabled(id: DroneLayerId, enabled: boolean) {
    const next = {...layers, [id]: {...layers[id], enabled}};
    setError('');
    setLayers(next);
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
  const [expandedOscillators, setExpandedOscillators] = useState<Readonly<Record<string, boolean>>>({});
  const [delaySettings, setDelaySettings] = useState<DelaySettings>(createDefaultDelaySettings);
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<SoundPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const importInput = useRef<HTMLInputElement | null>(null);
  const [morphStartId, setMorphStartId] = useState('');
  const [morphEndId, setMorphEndId] = useState('');
  const [morphPosition, setMorphPosition] = useState(0);
  const [morphEnabled, setMorphEnabled] = useState(false);
  function updateMorphPosition(position: number) {
    if (!morphEnabled) return;
    const start = presets.find(preset => preset.id === morphStartId);
    const end = presets.find(preset => preset.id === morphEndId);
    if (!start || !end || start.id === end.id) return;
    try {
      const morphed = morphPresets(start, end, position);
      applyScene({
        A: {drone: morphed.drone, modulation: morphed.modulation, harmony: layers.A.harmony,
          enabled: morphed.layerMix.firstLayerEnabled},
        B: morphed.layerMix.secondLayer
      }, morphed.layerMix.masterGain, morphed.delay);
      setMorphPosition(position);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot morph presets.'); }
  }
  useEffect(() => { void listPresets().then(setPresets).catch(reason => setError(String(reason))); }, []);
  async function saveCurrentPreset(snapshot: boolean) {
    try {
      const name = snapshot ? `Snapshot ${new Date().toLocaleString()}` : presetName.trim();
      if (!name) { setError('Enter a preset name.'); return; }
      const preset = createPreset(name, layers.A.drone, layers.A.modulation, delaySettings, layers.A.harmony,
        {firstLayerEnabled: layers.A.enabled, secondLayer: layers.B, masterGain}, activeLayer);
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
    engine.setMasterGain(masterGain);
    engine.setPerformancePosition(performancePosition.current);
    engine.updateDelay(delaySettings);
    applyLayersEnabled(layers);
    return engine;
  }

  function updateHoldMode(id: DroneLayerId, holding: boolean) {
    setHoldModes(previous => ({...previous, [id]: holding}));
    void controller.current?.setLayerHoldMode(id, holding).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Cannot change drone key mode.');
    });
  }

  function updateLayerEnvelope(id: DroneLayerId, envelope: DroneEnvelope) {
    controller.current?.setLayerEnvelope(id, envelope);
    setLayers(previous => ({...previous, [id]: {...previous[id], drone: {...previous[id].drone, envelope}}}));
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
      if (engine.isPlaying) {
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
  function loadBuiltInOscillatorPreset(presetId: string, oscillator: OscillatorSettings, number: number) {
    const preset = builtInOscillatorPresets.find(item => item.id === presetId);
    if (!preset) return;
    try {
      applyOscillatorSnapshot(createBuiltInOscillatorSnapshot(preset.id, oscillator));
      setOscillatorActionStatus(`${preset.name} loaded into Drone ${activeLayer} · Oscillator ${number}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot load oscillator preset.'); }
  }

  function copyOscillator(oscillator: OscillatorSettings, number: number) {
    setOscillatorClipboard({
      oscillator,
      modulations: lowFrequencyOscillatorSettings.filter(item => item.targetOscillatorId === oscillator.id)
    });
    setOscillatorActionStatus(`Drone ${activeLayer} · Oscillator ${number} copied`);
  }
  function pasteOscillator(oscillator: OscillatorSettings, number: number) {
    if (!oscillatorClipboard) return;
    try {
      applyOscillatorSnapshot(retargetOscillatorSnapshot(oscillatorClipboard, oscillator));
      setOscillatorActionStatus(`Drone ${activeLayer} · Oscillator ${number} pasted`);
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
  function updateLayerGain(id: DroneLayerId, gain: number) {
    controller.current?.layers[id].setGain(gain);
    setLayers(previous => ({...previous, [id]: {...previous[id], drone: {...previous[id].drone, gain}}}));
  }
  return <main className="instrument"><header><span className="eyebrow">ORBIT / SOUND LAB</span><h1>DRONE ENGINE</h1></header><section className="master"><button className={playing ? 'playing' : ''} disabled={playbackTransition} onClick={() => void togglePlayback()}>{playing ? '■ STOP ALL DRONES' : '▶ START DRONES'}</button><NumericSlider label="MASTER LEVEL" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      value={masterGain} onChange={gain => {controller.current?.setMasterGain(gain); setMasterGain(gain);}}/></section>
    <PerformancePad onChange={position => {
      performancePosition.current = position;
      controller.current?.setPerformancePosition(position);
    }}/>
    <section className="drone-layers" aria-label="Drone layers">
      {DRONE_LAYER_IDS.map(id => <div key={id} className={activeLayer === id ? 'drone-layer selected' : 'drone-layer'}>
        <div className="drone-layer-header">
          <button type="button" aria-pressed={activeLayer === id} onClick={() => setActiveLayer(id)}>DRONE {id}</button>
          <label className="switch">
            <input type="checkbox" aria-label={`Enable Drone ${id}`} disabled={playbackTransition || holdModes[id]} checked={layers[id].enabled && !holdModes[id]}
              onChange={event => updateLayerEnabled(id, event.target.checked)}/> {layers[id].enabled && !holdModes[id] ? 'ON' : 'OFF'}
          </label>
        </div>
        <NumericSlider label={`DRONE ${id} LEVEL`} unit="%" displayFactor={100} min={0} max={0.4} step={0.01}
          value={layers[id].drone.gain} onChange={gain => updateLayerGain(id, gain)}/>
        <label className="switch drone-key-mode">
          <input type="checkbox" aria-label={`Key mode for Drone ${id}`} checked={holdModes[id]}
            onChange={event => updateHoldMode(id, event.target.checked)}/> KEY MODE
        </label>
        <DroneKeyControls id={id} envelope={layers[id].drone.envelope} disabled={playbackTransition}
          onEnvelopeChange={envelope => updateLayerEnvelope(id, envelope)}
          onPress={() => void pressLayerKey(id)}
          onRelease={() => controller.current?.releaseLayerKey(id)}
          onBend={cents => controller.current?.setLayerBend(id, cents)}/>
      </div>)}
    </section>
    <DroneMixControls key={activeLayer} layerId={activeLayer} settings={settings.mix} onChange={updateDroneMix}/>
    <section className="harmony-engine" key={`harmony-${activeLayer}`}><h2>HARMONY ENGINE</h2><div className="harmony-modes">{(['free','natural','piano'] as const).map(mode => <button type="button" key={mode} className={harmony.mode === mode ? 'selected' : ''} aria-pressed={harmony.mode === mode} onClick={() => updateHarmony({...harmony,mode})}>{mode.toUpperCase()}</button>)}</div><div className="harmony-controls"><NumericSlider label="ROOT FREQUENCY" unit="Hz" min={55} max={220} step={1}
      value={harmony.rootFrequencyHz} onChange={value => updateHarmony({...harmony,rootFrequencyHz:value})}/><label>HARMONY<select value={harmony.chord} onChange={event => updateHarmony({...harmony,chord:event.target.value as HarmonySettings['chord']})}><option value="minor">Minor / melancholic</option><option value="major">Major / warm</option><option value="fifth">Open fifths / spacious</option><option value="ambient">Ambient / suspended</option></select></label><NumericSlider label="DETUNE / SPREAD" unit="cents" min={0} max={20} step={1}
      value={harmony.spreadCents} onChange={value => updateHarmony({...harmony,spreadCents:value})}/></div><div className="harmony-preview">{settings.oscillators.map((oscillator,index) => <span key={oscillator.id}>OSC {index+1} · {oscillator.frequencyHz.toFixed(1)} → {getEffectiveOscillatorFrequency(harmony,oscillator.frequencyHz,index).toFixed(1)} Hz</span>)}</div><p>{harmony.mode === 'free' ? 'FREE: frequency sliders and RANDOM use unrestricted frequencies.' : 'NATURAL / PIANO: RANDOM chooses a note from the selected harmony. Harmony processes the audible pitch without changing source frequencies.'}</p></section>
    <section className="master-delay"><div className="oscillator-title"><strong>MASTER ECHO / DELAY</strong><label className="switch"><input type="checkbox" checked={delaySettings.enabled} onChange={event => updateDelay({...delaySettings,enabled:event.target.checked})}/> ACTIVE</label></div><div className="delay-controls"><NumericSlider label="TIME" unit="s" min={0.05} max={2} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.timeSeconds} onChange={value => updateDelay({...delaySettings,timeSeconds:value})}/><NumericSlider label="FEEDBACK" unit="%" displayFactor={100} min={0} max={0.85} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.feedback} onChange={value => updateDelay({...delaySettings,feedback:value})}/><NumericSlider label="WET MIX" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      disabled={!delaySettings.enabled} value={delaySettings.mix} onChange={value => updateDelay({...delaySettings,mix:value})}/></div><p>Echo repeats the combined drone. Start with low feedback and mix.</p></section>
    <section className="preset-library"><h2>PRESET LIBRARY</h2><div className="preset-actions"><input aria-label="Preset name" placeholder="Preset name" maxLength={120} value={presetName} onChange={event => setPresetName(event.target.value)}/><button type="button" onClick={() => void saveCurrentPreset(false)}>SAVE PRESET</button><button type="button" onClick={() => void saveCurrentPreset(true)}>SAVE SNAPSHOT</button><button type="button" onClick={() => importInput.current?.click()}>IMPORT JSON</button><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void handlePresetImport(file); event.target.value = ''; }}/></div><div className="preset-morph"><div className="preset-morph-heading"><h3>PRESET MORPH</h3><label className="preset-morph-toggle"><input type="checkbox" checked={morphEnabled} onChange={event => setMorphEnabled(event.target.checked)}/> ENABLE MORPH</label></div><fieldset className="preset-morph-content" disabled={!morphEnabled}><div className="preset-morph-selectors"><label>PRESET A<select aria-label="Morph preset A" value={morphStartId} onChange={event => { setMorphStartId(event.target.value); setMorphPosition(0); }}><option value="">Select preset A</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label><label>PRESET B<select aria-label="Morph preset B" value={morphEndId} onChange={event => { setMorphEndId(event.target.value); setMorphPosition(0); }}><option value="">Select preset B</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label></div><NumericSlider label="MORPH POSITION" className="preset-morph-slider" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      value={morphPosition} disabled={!morphEnabled || !morphStartId || !morphEndId || morphStartId === morphEndId || !presets.some(preset => preset.id === morphStartId) || !presets.some(preset => preset.id === morphEndId)} onChange={value => updateMorphPosition(value)}/><p>Continuous parameters interpolate; waveform and ON/OFF switch at 50%. Moving the slider changes the current sound, not saved presets. Disabling morph keeps the current sound.</p></fieldset></div><div className="preset-list">{presets.length === 0 ? <p>No saved presets yet. Presets stay in this browser; export JSON for backup.</p> : presets.map(preset => <div className="preset-item" key={preset.id}><div><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleString()}</small></div><div className="preset-item-actions"><button type="button" aria-label={`Load ${preset.name} into Drone ${activeLayer}`} onClick={() => loadPreset(preset)}>LOAD TO {activeLayer}</button><button type="button" onClick={() => exportPreset(preset)}>EXPORT</button><button type="button" onClick={() => void removePreset(preset)}>DELETE</button></div></div>)}</div></section><section className="oscillator-switchboard" aria-label="Oscillator activation" key={`switches-${activeLayer}`}><h2>OSCILLATOR SWITCHES</h2><div className="oscillator-switches">{settings.oscillators.map((oscillator,index) => <label key={oscillator.id} className={`oscillator-quick-switch ${oscillator.enabled ? "is-active" : ""}`}><span>OSC {String(index+1).padStart(2,"0")}</span><input type="checkbox" checked={oscillator.enabled} onChange={event => updateOscillator({...oscillator,enabled:event.target.checked})}/><span className="oscillator-switch-state">{oscillator.enabled ? "ON" : "OFF"}</span></label>)}</div></section>{error && <p role="alert" className="error">{error}</p>}<section className="oscillators" key={`oscillators-${activeLayer}`}><h2>DRONE {activeLayer} OSCILLATORS <span className="oscillator-action-status" role="status">{oscillatorActionStatus}</span></h2>{settings.oscillators.map((oscillator,index) => <article key={oscillator.id} className={`oscillator-panel ${oscillator.enabled ? "" : "muted"}`}><div className="oscillator-card-header">
      <button type="button" className="oscillator-panel-toggle"
        aria-expanded={Boolean(expandedOscillators[`${activeLayer}:${oscillator.id}`])}
        aria-controls={`${oscillator.id}-settings`}
        onClick={() => setExpandedOscillators(previous => ({...previous,
          [`${activeLayer}:${oscillator.id}`]: !previous[`${activeLayer}:${oscillator.id}`]}))}>
        <strong>OSC {String(index + 1).padStart(2, '0')}</strong>
        <span className="oscillator-summary-status">{oscillator.enabled ? 'ACTIVE' : 'OFF'}</span>
        <span className="oscillator-expand-hint" aria-hidden="true"/>
      </button>
      <div className="oscillator-header-actions">
        <select className="oscillator-preset-select" aria-label={`Built-in preset for oscillator ${index + 1}`}
          value="" onChange={event => loadBuiltInOscillatorPreset(event.target.value, oscillator, index + 1)}>
          <option value="" disabled>PRESETS</option>
          {builtInOscillatorPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
        <button type="button" className="randomize-button"
          onClick={() => copyOscillator(oscillator, index + 1)} aria-label={`Copy oscillator ${index + 1}`}>COPY</button>
        <button type="button" className="randomize-button" disabled={!oscillatorClipboard}
          onClick={() => pasteOscillator(oscillator, index + 1)} aria-label={`Paste into oscillator ${index + 1}`}>PASTE</button>
      </div>
    </div>
      <OscillatorWaveform oscillatorId={oscillator.id} playing={playing && (layerEnabled || holdModes[activeLayer])}
        enabled={oscillator.enabled} getAnalyser={getWaveformAnalyser}/>
      <div className="oscillator-controls">
        <div className="oscillator-randomize-actions">
          <button type="button" className="randomize-button" onClick={() => randomizeOscillator(oscillator, 'random')}
            aria-label={`Randomize settings for oscillator ${index + 1}`}>⤨ RANDOM</button>
          <button type="button" className="randomize-button" onClick={() => randomizeOscillator(oscillator, 'variant')}
            aria-label={`Generate variant for oscillator ${index + 1}`} title="Vary each setting by up to 5% of its slider range">VARIANT</button>
        </div>
        <OscillatorControlSection title="Volume & Pan">
          <div className="oscillator-mix-controls">
            {renderOscillatorModulationSlider(oscillator, index, 'volume')}
            <OscillatorPanControl oscillatorId={oscillator.id} oscillatorNumber={index + 1} pan={oscillator.pan}
              onChange={pan => updateOscillator({...oscillator, pan})}/>
          </div>
          {renderOscillatorLfo(oscillator.id, 'amplitude')}
        </OscillatorControlSection>
        <div id={`${oscillator.id}-settings`} className="oscillator-panel-content" hidden={!expandedOscillators[`${activeLayer}:${oscillator.id}`]}>
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
              </select>
            </label>
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
      </div>
    </article>)}</section><section className="diagnostic"><h2>ANDROID AUDIO DIAGNOSTIC</h2><label><input type="checkbox" checked={renderingDiagnosticEnabled} onChange={event => setRenderingDiagnosticEnabled(event.target.checked)}/> Keep rendering active while playing (experiment)</label><div className="diagnostic-track"><div className="diagnostic-indicator" ref={renderingIndicator}/></div><p>Compare 30 seconds with this OFF and ON without touching the screen. This intentionally increases rendering work and battery use; it is not a permanent audio fix.</p><a href="./audio-diagnostic.html">Open standalone audio output test</a></section><footer>WEB AUDIO ENGINE · SOLAR 42 INSPIRED · USE LOW VOLUME</footer></main>;
}
