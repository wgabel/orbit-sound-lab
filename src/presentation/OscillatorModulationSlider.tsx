import { useCallback, useId, useRef, useState } from 'react';
import { applyPitchOffset, getEffectiveCutoffLfoDepth } from '@domain/modulation';
import type { OscillatorSettings } from '@domain/drone';
import {
  getAmplitudeModulationRange, getOscillatorModulationRange, getOscillatorSliderSpan, OSCILLATOR_MODULATION_PARAMETERS,
  replaceOscillatorModulationRoute, validateOscillatorModulationRoutes
} from '@domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute, OscillatorModulationSignal } from '@domain/oscillator-modulation';
import { NumericSlider } from './NumericSlider';

interface OscillatorModulationSliderProps {
  readonly oscillator: OscillatorSettings;
  readonly effectiveFrequency: number;
  readonly oscillators: readonly OscillatorSettings[];
  readonly parameter: OscillatorModulationParameter;
  readonly routes: readonly OscillatorModulationRoute[];
  readonly sampleRate?: number;
  readonly playing: boolean;
  readonly pitchDepthCents?: number;
  readonly amplitudeDepth?: number;
  readonly cutoffDepthHz?: number;
  readonly readOscillatorCutoff: (oscillatorId: string) => number | null;
  readonly readOscillatorVolume: (oscillatorId: string) => number | null;
  readonly readOscillatorFrequency: (oscillatorId: string) => number | null;
  readonly getModulationAnalyser: (targetId: string, parameter: OscillatorModulationParameter) => AnalyserNode | null;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
  readonly onRouteChange: (route: OscillatorModulationRoute) => void;
}

export function OscillatorModulationSlider({
  oscillator, effectiveFrequency, oscillators, parameter, routes, sampleRate, playing, getModulationAnalyser, pitchDepthCents, readOscillatorFrequency, amplitudeDepth, readOscillatorVolume,
  cutoffDepthHz, readOscillatorCutoff, disabled, onChange, onRouteChange
}: OscillatorModulationSliderProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const [routeError, setRouteError] = useState('');
  const {label, unit, minimum, maximum, step} = OSCILLATOR_MODULATION_PARAMETERS[parameter];
  const span = getOscillatorSliderSpan(parameter);
  const factor = unit === '%' ? 100 : 1;
  const oscillatorOptions = oscillators.map((item, index) => ({
    id: item.id, enabled: item.enabled, name: `OSC ${String(index + 1).padStart(2, '0')}`
  }));
  const sources = oscillatorOptions.filter(source => source.id !== oscillator.id);
  const route = routes.find(item => item.targetId === oscillator.id && item.parameter === parameter) ?? {
    targetId: oscillator.id, parameter, sourceId: sources[0].id, signal: 'waveform', depth: parameter === 'volume' ? 0.1 : parameter === 'frequency' ? 10 : 100, enabled: false
  };
  const source = sources.find(item => item.id === route.sourceId);
  const target = oscillatorOptions.find(item => item.id === oscillator.id);
  const signal = route.signal ?? 'level';
  function applyRoute(patch: Partial<Pick<OscillatorModulationRoute, 'sourceId' | 'signal' | 'depth' | 'enabled'>>) {
    const next = {...route, ...patch};
    try {
      validateOscillatorModulationRoutes(replaceOscillatorModulationRoute(routes, next), oscillators);
      onRouteChange(next);
      setRouteError('');
    } catch (reason) {
      setRouteError(reason instanceof Error ? reason.message : 'Cannot change oscillator route.');
    }
  }
  const baseRange = getOscillatorModulationRange(oscillator, parameter, 0);
  const range = getOscillatorModulationRange({...oscillator, frequencyHz: effectiveFrequency}, parameter,
    route.enabled ? route.depth : 0, sampleRate);
  const samples = useRef(new Float32Array(32));
  const readLiveValue = useCallback(() => {
    if (parameter === 'frequency') return readOscillatorFrequency(oscillator.id);
    if (parameter === 'cutoff') return readOscillatorCutoff(oscillator.id);
    if (amplitudeDepth !== undefined) return readOscillatorVolume(oscillator.id);
    const analyser = getModulationAnalyser(oscillator.id, parameter);
    if (!analyser) return null;
    const buffer = samples.current;
    analyser.getFloatTimeDomainData(buffer);
    const offset = signal === 'waveform' ? buffer[buffer.length - 1] :
      buffer.reduce((total, sample) => total + sample, 0) / buffer.length;
    return range.base + offset;
  }, [amplitudeDepth, getModulationAnalyser, oscillator.id, parameter, range.base, signal, readOscillatorCutoff, readOscillatorFrequency, readOscillatorVolume]);
  const showPreview = !disabled && (route.enabled || pitchDepthCents !== undefined ||
    amplitudeDepth !== undefined || cutoffDepthHz !== undefined);
  const depthCents = pitchDepthCents ?? 0;
  const currentSampleRate = sampleRate ?? 48000;
  const nyquist = currentSampleRate / 2;
  const cutoffDepth = cutoffDepthHz === undefined ? 0 : getEffectiveCutoffLfoDepth(cutoffDepthHz, range, currentSampleRate);
  const bounds: readonly [number, number] = parameter === 'frequency' ? [
    Math.min(nyquist, applyPitchOffset(range.lower, oscillator.detuneCents - depthCents)),
    Math.min(nyquist, applyPitchOffset(range.upper, oscillator.detuneCents + depthCents))
  ] : amplitudeDepth !== undefined ? getAmplitudeModulationRange(range.lower, range.upper, amplitudeDepth) :
    [range.lower - cutoffDepth, range.upper + cutoffDepth];

  return <>
    <NumericSlider label={label} unit={unit} displayFactor={factor} min={minimum} max={maximum}
      scale={parameter === 'volume' ? 'quadratic' : 'logarithmic'}
      step={parameter === 'cutoff' ? 0.1 : parameter === 'volume' ? 0.0001 : step}
      value={baseRange.base} disabled={disabled} onChange={onChange}
      modulationRange={showPreview ? bounds : undefined}
      readLiveValue={playing && showPreview ? readLiveValue : undefined} showLiveValue={parameter !== 'volume' || amplitudeDepth !== undefined}
      action={<button type="button" className="oscillator-modulation-button" data-active={route.enabled}
        aria-label={`Route to ${label.toLowerCase()}${route.enabled && source ? ` from ${source.name}` : ''}`} aria-haspopup="dialog" aria-controls={dialogId}
        onClick={() => { setRouteError(''); dialog.current?.showModal(); }}>
        {route.enabled ? source?.name : 'Route'}
      </button>}/>
    <dialog id={dialogId} ref={dialog} className="oscillator-modulation-dialog" aria-labelledby={`${dialogId}-title`}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="oscillator-modulation-panel">
        <div className="oscillator-modulation-heading">
          <h3 id={`${dialogId}-title`}>{target?.name} · {label}</h3>
          <button type="button" aria-label="Close oscillator route" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <label className="switch"><input type="checkbox" checked={route.enabled}
          onChange={event => applyRoute({enabled: event.target.checked})}/> Enable route</label>
        <label>Source oscillator
          <select value={route.sourceId} onChange={event => applyRoute({sourceId: event.target.value})}>
            {sources.map(item => <option key={item.id} value={item.id}>{item.name}{item.enabled ? '' : ' (off)'}</option>)}
          </select>
        </label>
        <label>Source signal
          <select value={signal} onChange={event => applyRoute({signal: event.target.value as OscillatorModulationSignal})}>
            <option value="waveform">Waveform</option>
            <option value="level">Level and Amplitude LFO</option>
          </select>
        </label>
        <p>{signal === 'waveform' ? 'Uses the source waveform before its filter and volume.' :
          'Follows the source volume and Amplitude LFO.'}</p>
        <NumericSlider label="Depth ±" unit={parameter === 'volume' ? 'pp' : 'Hz'} displayFactor={factor} min={0} max={span}
          step={parameter === 'volume' ? 0.001 : 0.1} scale="quadratic"
          value={route.depth} onChange={depth => applyRoute({depth})}/>
        {route.enabled && source?.enabled === false && <p>Turn on {source.name} to hear this route.</p>}
        {disabled && <p>Enable the low-pass filter to hear this route.</p>}
        {routeError && <p role="alert" className="oscillator-route-error">{routeError}</p>}
      </div>
    </dialog>
  </>;
}
