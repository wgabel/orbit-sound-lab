import { useEffect, useRef, useState } from 'react';
import type { SynthesizerController } from '../application/audio-contracts';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { createDefaultLowFrequencyOscillatorSettings } from '../domain/modulation';
import type { DroneSettings, OscillatorSettings } from '../domain/drone';
import { createDefaultDroneSettings } from '../domain/drone';
import { applyInitialSynthesizerSettings } from '../application/apply-initial-synthesizer-settings';
import { createSynthesizer } from '../composition/create-synthesizer';
import './styles.css';
export function App() {
  const controller = useRef<SynthesizerController | null>(null);
  const [settings, setSettings] = useState<DroneSettings>(createDefaultDroneSettings);
  const [lowFrequencyOscillatorSettings, setLowFrequencyOscillatorSettings] = useState<LowFrequencyOscillatorSettings>(createDefaultLowFrequencyOscillatorSettings);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { controller.current?.dispose(); controller.current = null; }, []);
  async function togglePlayback() {
    try {
      setError('');
      if (!controller.current) { controller.current = createSynthesizer(); applyInitialSynthesizerSettings(controller.current, settings, lowFrequencyOscillatorSettings); }
      if (controller.current.isPlaying) { controller.current.stop(); setPlaying(false); }
      else { await controller.current.start(); setPlaying(true); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Audio could not start.'); }
  }
  function updateOscillator(oscillator: OscillatorSettings) {
    try { controller.current?.updateOscillator(oscillator); setSettings(previous => ({...previous, oscillators: previous.oscillators.map(item => item.id === oscillator.id ? oscillator : item)})); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update oscillator.'); }
  }
  function updateLowFrequencyOscillator(settings: LowFrequencyOscillatorSettings) {
    try { controller.current?.updateLowFrequencyOscillator(settings); setLowFrequencyOscillatorSettings(settings); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot update LFO.'); }
  }
  function updateGain(gain: number) { controller.current?.setGain(gain); setSettings(previous => ({...previous, gain})); }
  return <main className="instrument"><header><span className="eyebrow">ORBIT / SOUND LAB</span><h1>DRONE ENGINE <span>01</span></h1><p>Five detuned oscillators. One evolving voice.</p></header><section className="master"><button className={playing ? 'playing' : ''} onClick={() => void togglePlayback()}>{playing ? '■ STOP DRONE' : '▶ START DRONE'}</button><label>MASTER LEVEL <strong>{Math.round(settings.gain * 100)}%</strong><input type="range" min="0" max="0.4" step="0.01" value={settings.gain} onChange={event => updateGain(Number(event.target.value))}/></label></section>{error && <p role="alert" className="error">{error}</p>}<section className="oscillators"><h2>OSCILLATOR BANK</h2>{settings.oscillators.map((oscillator,index) => <article key={oscillator.id} className={oscillator.enabled ? '' : 'muted'}><div className="oscillator-title"><strong>OSC {String(index+1).padStart(2,'0')}</strong><label className="switch"><input type="checkbox" checked={oscillator.enabled} onChange={event => updateOscillator({...oscillator, enabled:event.target.checked})}/> ACTIVE</label></div><label>FREQUENCY <output>{oscillator.frequencyHz} Hz</output><input type="range" min="40" max="880" step="1" value={oscillator.frequencyHz} onChange={event => updateOscillator({...oscillator,frequencyHz:Number(event.target.value)})}/></label><label>DETUNE <output>{oscillator.detuneCents > 0 ? '+' : ''}{oscillator.detuneCents} cents</output><input type="range" min="-100" max="100" step="1" value={oscillator.detuneCents} onChange={event => updateOscillator({...oscillator,detuneCents:Number(event.target.value)})}/></label><label>WAVEFORM <select value={oscillator.waveform} onChange={event => updateOscillator({...oscillator,waveform:event.target.value as OscillatorSettings['waveform']})}><option value="sine">Sine (diagnostic)</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option><option value="square">Square</option></select></label></article>)}</section><section className="oscillators"><h2>LOW FREQUENCY OSCILLATOR</h2><article><div className="oscillator-title"><strong>LFO 01 · PITCH MODULATION</strong><label className="switch"><input type="checkbox" checked={lowFrequencyOscillatorSettings.enabled} onChange={event => updateLowFrequencyOscillator({...lowFrequencyOscillatorSettings,enabled:event.target.checked})}/> ACTIVE</label></div><label>RATE <output>{lowFrequencyOscillatorSettings.frequencyHz.toFixed(2)} Hz</output><input type="range" min="0.01" max="10" step="0.01" value={lowFrequencyOscillatorSettings.frequencyHz} onChange={event => updateLowFrequencyOscillator({...lowFrequencyOscillatorSettings,frequencyHz:Number(event.target.value)})}/></label><label>DEPTH <output>{lowFrequencyOscillatorSettings.depthCents} cents</output><input type="range" min="0" max="300" step="1" value={lowFrequencyOscillatorSettings.depthCents} onChange={event => updateLowFrequencyOscillator({...lowFrequencyOscillatorSettings,depthCents:Number(event.target.value)})}/></label><label>WAVEFORM <select value={lowFrequencyOscillatorSettings.waveform} onChange={event => updateLowFrequencyOscillator({...lowFrequencyOscillatorSettings,waveform:event.target.value as LowFrequencyOscillatorSettings['waveform']})}><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option></select></label><label>TARGET <select value={lowFrequencyOscillatorSettings.targetOscillatorId} onChange={event => updateLowFrequencyOscillator({...lowFrequencyOscillatorSettings,targetOscillatorId:event.target.value})}>{settings.oscillators.map((oscillator,index) => <option key={oscillator.id} value={oscillator.id}>OSC {String(index+1).padStart(2,'0')}</option>)}</select></label></article></section><footer>WEB AUDIO ENGINE · SOLAR 42 INSPIRED · USE LOW VOLUME</footer></main>;
}
