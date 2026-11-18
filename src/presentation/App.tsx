import { useCallback, useEffect, useRef, useState } from 'react';
import { createDefaultDelaySettings } from '../domain/delay';
import type { DelaySettings } from '../domain/delay';
import type { SoundLabController } from '../application/audio-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { createDefaultLowFrequencyOscillators } from '../domain/modulation';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
import { createDefaultDroneSettings } from '../domain/drone';
import { randomizeOscillatorSettings } from '../domain/randomize-oscillator-settings';
import { applyInitialSynthesizerSettings } from '../application/apply-initial-synthesizer-settings';
import { createSynthesizer } from '../composition/create-synthesizer';
import { useRenderingActivityDiagnostic } from './use-rendering-activity-diagnostic';
import { createPreset, deletePreset, exportPreset, importPreset, listPresets, savePreset } from '../domain/preset-library';
import type { SoundPreset } from '../domain/preset-library';
import { morphPresets } from '../domain/preset-morphing';
import { DEFAULT_HARMONY_SETTINGS, getEffectiveOscillatorFrequency } from '../domain/harmony';
import type { HarmonySettings } from '../domain/harmony';
import { OscillatorWaveform } from './OscillatorWaveform';
import './styles.css';
export function App() {
  const controller = useRef<SoundLabController | null>(null);
  const getWaveformAnalyser = useCallback((oscillatorId: string) => controller.current?.getWaveformAnalyser(oscillatorId) ?? null, []);
  const [settings, setSettings] = useState<DroneSettings>(createDefaultDroneSettings);
  const [lowFrequencyOscillatorSettings, setLowFrequencyOscillatorSettings] = useState<readonly LowFrequencyOscillatorSettings[]>(() => createDefaultLowFrequencyOscillators(createDefaultDroneSettings().oscillators.map(oscillator => oscillator.id)));
  const [playing, setPlaying] = useState(false);
  const [harmony, setHarmony] = useState<HarmonySettings>(DEFAULT_HARMONY_SETTINGS);
  function applyAudibleOscillators(drone: DroneSettings, harmonySettings: HarmonySettings) {
    for (const [index, oscillator] of drone.oscillators.entries()) {
      controller.current?.updateOscillator({...oscillator, frequencyHz: getEffectiveOscillatorFrequency(harmonySettings, oscillator.frequencyHz, index)});
    }
  }
  function updateHarmony(next: HarmonySettings) {
    try {
      applyAudibleOscillators(settings, next);
      setHarmony(next);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update harmony.'); }
  }
  const [expandedOscillators, setExpandedOscillators] = useState<Readonly<Record<string, boolean>>>({});
  const [delaySettings, setDelaySettings] = useState<DelaySettings>(createDefaultDelaySettings);
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<SoundPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
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
      if (controller.current) {
        applyAudibleOscillators(morphed.drone, harmony);
        for (const modulation of morphed.modulation) controller.current.updateLowFrequencyOscillator(modulation);
        controller.current.setGain(morphed.drone.gain);
        controller.current.updateDelay(morphed.delay);
      }
      setSettings(morphed.drone);
      setLowFrequencyOscillatorSettings(morphed.modulation);
      setDelaySettings(morphed.delay);
      setMorphPosition(position);
      setSelectedPresetId('');
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot morph presets.'); }
  }
  useEffect(() => { void listPresets().then(setPresets).catch(reason => setError(String(reason))); }, []);
  async function saveCurrentPreset(snapshot: boolean) {
    try {
      const name = snapshot ? `Snapshot ${new Date().toLocaleString()}` : presetName.trim();
      if (!name) { setError('Enter a preset name.'); return; }
      const preset = createPreset(name, settings, lowFrequencyOscillatorSettings, delaySettings, harmony);
      await savePreset(preset);
      setPresets(await listPresets());
      setSelectedPresetId(preset.id);
      setPresetName('');
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot save preset.'); }
  }
  function loadPreset(preset: SoundPreset) {
    try {
      // Apply to the live engine before replacing UI state.
      if (controller.current) {
        applyAudibleOscillators(preset.drone, preset.harmony ?? DEFAULT_HARMONY_SETTINGS);
        for (const modulation of preset.modulation) controller.current.updateLowFrequencyOscillator(modulation);
        controller.current.setGain(preset.drone.gain);
        controller.current.updateDelay(preset.delay);
      }
      setSettings(preset.drone);
      setLowFrequencyOscillatorSettings(preset.modulation);
      setDelaySettings(preset.delay);
      setHarmony(preset.harmony ?? DEFAULT_HARMONY_SETTINGS);
      setSelectedPresetId(preset.id);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot load preset.'); }
  }
  async function removePreset(preset: SoundPreset) {
    try {
      if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
      await deletePreset(preset.id);
      setPresets(await listPresets());
      if (selectedPresetId === preset.id) setSelectedPresetId('');
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot delete preset.'); }
  }
  async function handlePresetImport(file: File) {
    try {
      const preset = await importPreset(file);
      setPresets(await listPresets());
      setSelectedPresetId(preset.id);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot import preset.'); }
  }
  const [renderingDiagnosticEnabled, setRenderingDiagnosticEnabled] = useState(false);
  const renderingIndicator = useRenderingActivityDiagnostic(renderingDiagnosticEnabled && playing);
  useEffect(() => () => { controller.current?.dispose(); controller.current = null; }, []);
  async function togglePlayback() {
    try {
      setError('');
      if (!controller.current) { controller.current = createSynthesizer(); applyInitialSynthesizerSettings(controller.current, {...settings, oscillators: settings.oscillators.map((oscillator,index) => ({...oscillator, frequencyHz: getEffectiveOscillatorFrequency(harmony, oscillator.frequencyHz, index)}))}, lowFrequencyOscillatorSettings); controller.current.updateDelay(delaySettings); }
      if (controller.current.isPlaying) { controller.current.stop(); setPlaying(false); }
      else { await controller.current.start(); setPlaying(true); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Audio could not start.'); }
  }
  function updateOscillator(oscillator: OscillatorSettings) {
    try { controller.current?.updateOscillator({...oscillator,frequencyHz:getEffectiveOscillatorFrequency(harmony,oscillator.frequencyHz,settings.oscillators.findIndex(item => item.id === oscillator.id))}); setSettings(previous => ({...previous, oscillators: previous.oscillators.map(item => item.id === oscillator.id ? oscillator : item)})); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update oscillator.'); }
  }
  function updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings) {
    try { controller.current?.updateLowFrequencyOscillator(settings); setLowFrequencyOscillatorSettings(previous => previous.map(item => item.targetOscillatorId === settings.targetOscillatorId && item.destination === settings.destination ? settings : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update LFO.'); }
  }
  function randomizeOscillator(oscillator: OscillatorSettings, modulations: readonly LowFrequencyOscillatorSettings[]) {
    const randomized = randomizeOscillatorSettings(oscillator, modulations[0]);
    const randomizedModulations = modulations.map(modulation => randomizeOscillatorSettings(oscillator, modulation).modulation);
    const sourceOscillator = randomized.oscillator;
    try {
      controller.current?.updateOscillator({...sourceOscillator,frequencyHz:getEffectiveOscillatorFrequency(harmony,sourceOscillator.frequencyHz,settings.oscillators.findIndex(item => item.id === oscillator.id))});
      for (const modulation of randomizedModulations) controller.current?.updateLowFrequencyOscillator(modulation);
      setSettings(previous => ({...previous, oscillators: previous.oscillators.map(item => item.id === oscillator.id ? sourceOscillator : item)}));
      setLowFrequencyOscillatorSettings(previous => previous.map(item => randomizedModulations.find(modulation => modulation.targetOscillatorId === item.targetOscillatorId && modulation.destination === item.destination) ?? item));
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot randomize oscillator.'); }
  }
  function updateDelay(next: DelaySettings) {
    try { controller.current?.updateDelay(next); setDelaySettings(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update delay.'); }
  }
  function updateGain(gain: number) { controller.current?.setGain(gain); setSettings(previous => ({...previous, gain})); }
  return <main className="instrument"><header><span className="eyebrow">ORBIT / SOUND LAB</span><h1>DRONE ENGINE <span>01</span></h1><p>Five detuned oscillators. One evolving voice.</p></header><section className="master"><button className={playing ? 'playing' : ''} onClick={() => void togglePlayback()}>{playing ? '■ STOP DRONE' : '▶ START DRONE'}</button><label>MASTER LEVEL <strong>{Math.round(settings.gain * 100)}%</strong><input type="range" min="0" max="0.4" step="0.01" value={settings.gain} onChange={event => updateGain(Number(event.target.value))}/></label></section><section className="harmony-engine"><h2>HARMONY ENGINE</h2><div className="harmony-modes">{(['free','natural','piano'] as const).map(mode => <button type="button" key={mode} className={harmony.mode === mode ? 'selected' : ''} aria-pressed={harmony.mode === mode} onClick={() => updateHarmony({...harmony,mode})}>{mode.toUpperCase()}</button>)}</div><div className="harmony-controls"><label>ROOT FREQUENCY <output>{harmony.rootFrequencyHz} Hz</output><input type="range" min="55" max="220" step="1" value={harmony.rootFrequencyHz} onChange={event => updateHarmony({...harmony,rootFrequencyHz:Number(event.target.value)})}/></label><label>HARMONY<select value={harmony.chord} onChange={event => updateHarmony({...harmony,chord:event.target.value as HarmonySettings['chord']})}><option value="minor">Minor / melancholic</option><option value="major">Major / warm</option><option value="fifth">Open fifths / spacious</option><option value="ambient">Ambient / suspended</option></select></label><label>DETUNE / SPREAD <output>{harmony.spreadCents} cents</output><input type="range" min="0" max="20" step="1" value={harmony.spreadCents} onChange={event => updateHarmony({...harmony,spreadCents:Number(event.target.value)})}/></label></div><div className="harmony-preview">{settings.oscillators.map((oscillator,index) => <span key={oscillator.id}>OSC {index+1} · {oscillator.frequencyHz.toFixed(1)} → {getEffectiveOscillatorFrequency(harmony,oscillator.frequencyHz,index).toFixed(1)} Hz</span>)}</div><p>{harmony.mode === 'free' ? 'FREE: frequency sliders and RANDOM use unrestricted frequencies.' : 'NATURAL / PIANO: RANDOM chooses a note from the selected harmony. Harmony processes the audible pitch without changing source frequencies.'}</p></section><section className="preset-library"><h2>PRESET LIBRARY</h2><div className="preset-actions"><input aria-label="Preset name" placeholder="Preset name" maxLength={120} value={presetName} onChange={event => setPresetName(event.target.value)}/><button type="button" onClick={() => void saveCurrentPreset(false)}>SAVE PRESET</button><button type="button" onClick={() => void saveCurrentPreset(true)}>SAVE SNAPSHOT</button><button type="button" onClick={() => importInput.current?.click()}>IMPORT JSON</button><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void handlePresetImport(file); event.target.value = ''; }}/></div><div className="preset-morph"><div className="preset-morph-heading"><h3>PRESET MORPH</h3><label className="preset-morph-toggle"><input type="checkbox" checked={morphEnabled} onChange={event => setMorphEnabled(event.target.checked)}/> ENABLE MORPH</label></div><fieldset className="preset-morph-content" disabled={!morphEnabled}><div className="preset-morph-selectors"><label>PRESET A<select aria-label="Morph preset A" value={morphStartId} onChange={event => { setMorphStartId(event.target.value); setMorphPosition(0); }}><option value="">Select preset A</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label><label>PRESET B<select aria-label="Morph preset B" value={morphEndId} onChange={event => { setMorphEndId(event.target.value); setMorphPosition(0); }}><option value="">Select preset B</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label></div><label className="preset-morph-slider">MORPH POSITION <output>{Math.round(morphPosition * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={morphPosition} disabled={!morphEnabled || !morphStartId || !morphEndId || morphStartId === morphEndId || !presets.some(preset => preset.id === morphStartId) || !presets.some(preset => preset.id === morphEndId)} onChange={event => updateMorphPosition(Number(event.target.value))}/></label><p>Continuous parameters interpolate; waveform and ON/OFF switch at 50%. Moving the slider changes the current sound, not saved presets. Disabling morph keeps the current sound.</p></fieldset></div><div className="preset-list">{presets.length === 0 ? <p>No saved presets yet. Presets stay in this browser; export JSON for backup.</p> : presets.map(preset => <div className="preset-item" key={preset.id}><div><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleString()}</small></div><div className="preset-item-actions"><button type="button" aria-label={`Load ${preset.name}`} onClick={() => loadPreset(preset)}>{selectedPresetId === preset.id ? 'LOAD AGAIN' : 'LOAD'}</button><button type="button" onClick={() => exportPreset(preset)}>EXPORT</button><button type="button" onClick={() => void removePreset(preset)}>DELETE</button></div></div>)}</div></section><section className="oscillator-switchboard" aria-label="Oscillator activation"><h2>OSCILLATOR SWITCHES</h2><div className="oscillator-switches">{settings.oscillators.map((oscillator,index) => <label key={oscillator.id} className={`oscillator-quick-switch ${oscillator.enabled ? "is-active" : ""}`}><span>OSC {String(index+1).padStart(2,"0")}</span><input type="checkbox" checked={oscillator.enabled} onChange={event => updateOscillator({...oscillator,enabled:event.target.checked})}/><span className="oscillator-switch-state">{oscillator.enabled ? "ON" : "OFF"}</span></label>)}</div></section>{error && <p role="alert" className="error">{error}</p>}<section className="master-delay"><div className="oscillator-title"><strong>MASTER ECHO / DELAY</strong><label className="switch"><input type="checkbox" checked={delaySettings.enabled} onChange={event => updateDelay({...delaySettings,enabled:event.target.checked})}/> ACTIVE</label></div><div className="delay-controls"><label>TIME <output>{delaySettings.timeSeconds.toFixed(2)} s</output><input type="range" min="0.05" max="2" step="0.01" disabled={!delaySettings.enabled} value={delaySettings.timeSeconds} onChange={event => updateDelay({...delaySettings,timeSeconds:Number(event.target.value)})}/></label><label>FEEDBACK <output>{Math.round(delaySettings.feedback*100)}%</output><input type="range" min="0" max="0.85" step="0.01" disabled={!delaySettings.enabled} value={delaySettings.feedback} onChange={event => updateDelay({...delaySettings,feedback:Number(event.target.value)})}/></label><label>WET MIX <output>{Math.round(delaySettings.mix*100)}%</output><input type="range" min="0" max="1" step="0.01" disabled={!delaySettings.enabled} value={delaySettings.mix} onChange={event => updateDelay({...delaySettings,mix:Number(event.target.value)})}/></label></div><p>Echo repeats the combined drone. Start with low feedback and mix.</p></section><section className="oscillators"><h2>OSCILLATOR BANK</h2>{settings.oscillators.map((oscillator,index) => <article key={oscillator.id} className={`oscillator-panel ${oscillator.enabled ? "" : "muted"}`}><button type="button" className="oscillator-panel-toggle" aria-expanded={Boolean(expandedOscillators[oscillator.id])} aria-controls={`${oscillator.id}-settings`} onClick={() => setExpandedOscillators(previous => ({...previous,[oscillator.id]: !previous[oscillator.id]}))}><strong>OSC {String(index+1).padStart(2,"0")}</strong><span className="oscillator-summary-status">{oscillator.enabled ? "ACTIVE" : "OFF"}</span><span className="oscillator-expand-hint">{expandedOscillators[oscillator.id] ? "HIDE DETAILS" : "DETAILS"}</span></button><OscillatorWaveform oscillatorId={oscillator.id} playing={playing} enabled={oscillator.enabled} getAnalyser={getWaveformAnalyser}/><div className="oscillator-always-visible"><label>VOLUME <output>{Math.round(oscillator.volume * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={oscillator.volume} onChange={event => updateOscillator({...oscillator,volume:Number(event.target.value)})}/></label><button type="button" className="randomize-button" onClick={() => randomizeOscillator(oscillator, lowFrequencyOscillatorSettings.filter(item => item.targetOscillatorId === oscillator.id))} aria-label={`Randomize settings for oscillator ${index+1}`}>⤨ RANDOM</button></div><div id={`${oscillator.id}-settings`} className="oscillator-panel-content" hidden={!expandedOscillators[oscillator.id]}><label>FREQUENCY <output>{oscillator.frequencyHz} Hz</output><input type="range" min="40" max="880" step="1" value={oscillator.frequencyHz} onChange={event => updateOscillator({...oscillator,frequencyHz:Number(event.target.value)})}/></label><label>DETUNE <output>{oscillator.detuneCents > 0 ? '+' : ''}{oscillator.detuneCents} cents</output><input type="range" min="-100" max="100" step="1" value={oscillator.detuneCents} onChange={event => updateOscillator({...oscillator,detuneCents:Number(event.target.value)})}/></label><label>WAVEFORM <select value={oscillator.waveform} onChange={event => updateOscillator({...oscillator,waveform:event.target.value as OscillatorSettings['waveform']})}><option value="sine">Sine (diagnostic)</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option><option value="square">Square</option></select></label><div className="oscillator-filter"><div className="oscillator-title"><strong>LOW-PASS FILTER</strong><label className="switch"><input type="checkbox" checked={oscillator.filter.enabled} onChange={event => updateOscillator({...oscillator,filter:{...oscillator.filter,enabled:event.target.checked}})}/> ACTIVE</label></div><label>CUTOFF <output>{oscillator.filter.cutoffHz} Hz</output><input type="range" min="20" max="20000" step="1" disabled={!oscillator.filter.enabled} value={oscillator.filter.cutoffHz} onChange={event => updateOscillator({...oscillator,filter:{...oscillator.filter,cutoffHz:Number(event.target.value)}})}/></label><label>RESONANCE <output>{oscillator.filter.resonance.toFixed(1)}</output><input type="range" min="0.1" max="12" step="0.1" disabled={!oscillator.filter.enabled} value={oscillator.filter.resonance} onChange={event => updateOscillator({...oscillator,filter:{...oscillator.filter,resonance:Number(event.target.value)}})}/></label></div><div className="oscillator-fade"><div className="oscillator-title"><strong>VOLUME FADES</strong></div><label>FADE IN <output>{oscillator.fade.fadeInSeconds.toFixed(1)} s</output><input type="range" min="0.1" max="30" step="0.1" value={oscillator.fade.fadeInSeconds} onChange={event => updateOscillator({...oscillator,fade:{...oscillator.fade,fadeInSeconds:Number(event.target.value)}})}/></label><label>FADE OUT <output>{oscillator.fade.fadeOutSeconds.toFixed(1)} s</output><input type="range" min="0.1" max="30" step="0.1" value={oscillator.fade.fadeOutSeconds} onChange={event => updateOscillator({...oscillator,fade:{...oscillator.fade,fadeOutSeconds:Number(event.target.value)}})}/></label></div><div className="oscillator-lfo"><div className="oscillator-title"><strong>INDEPENDENT LFO MODULATION</strong></div>{lowFrequencyOscillatorSettings.filter(item => item.targetOscillatorId === oscillator.id).map(modulation => <div className="lfo-destination" key={modulation.destination}><div className="oscillator-title"><strong>{modulation.destination === 'pitch' ? 'PITCH' : modulation.destination === 'filterCutoff' ? 'FILTER CUTOFF' : 'AMPLITUDE'}</strong><label className="switch"><input type="checkbox" checked={modulation.enabled} onChange={event => updateLowFrequencyOscillator({...modulation,enabled:event.target.checked})}/> ACTIVE</label></div><label>RATE <output>{modulation.frequencyHz.toFixed(2)} Hz</output><input type="range" min="0.01" max="20" step="0.01" disabled={!modulation.enabled} value={modulation.frequencyHz} onChange={event => updateLowFrequencyOscillator({...modulation,frequencyHz:Number(event.target.value)})}/></label>{modulation.destination === 'pitch' ? <label>DEPTH <output>{modulation.depthCents} cents</output><input type="range" min="0" max="300" step="1" disabled={!modulation.enabled} value={modulation.depthCents} onChange={event => updateLowFrequencyOscillator({...modulation,depthCents:Number(event.target.value)})}/></label> : modulation.destination === 'amplitude' ? <label>DEPTH <output>{Math.round(modulation.depthAmplitude*200)}%</output><input type="range" min="0" max="0.5" step="0.01" disabled={!modulation.enabled} value={modulation.depthAmplitude} onChange={event => updateLowFrequencyOscillator({...modulation,depthAmplitude:Number(event.target.value)})}/></label> : <label>DEPTH <output>{modulation.depthHz} Hz</output><input type="range" min="0" max="5000" step="10" disabled={!modulation.enabled} value={modulation.depthHz} onChange={event => updateLowFrequencyOscillator({...modulation,depthHz:Number(event.target.value)})}/></label>}<label>WAVEFORM <select disabled={!modulation.enabled} value={modulation.waveform} onChange={event => updateLowFrequencyOscillator({...modulation,waveform:event.target.value as LowFrequencyOscillatorSettings['waveform']})}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option></select></label></div>)}</div></div></article>)}</section><section className="diagnostic"><h2>ANDROID AUDIO DIAGNOSTIC</h2><label><input type="checkbox" checked={renderingDiagnosticEnabled} onChange={event => setRenderingDiagnosticEnabled(event.target.checked)}/> Keep rendering active while playing (experiment)</label><div className="diagnostic-track"><div className="diagnostic-indicator" ref={renderingIndicator}/></div><p>Compare 30 seconds with this OFF and ON without touching the screen. This intentionally increases rendering work and battery use; it is not a permanent audio fix.</p></section><footer>WEB AUDIO ENGINE · SOLAR 42 INSPIRED · USE LOW VOLUME</footer></main>;
}
