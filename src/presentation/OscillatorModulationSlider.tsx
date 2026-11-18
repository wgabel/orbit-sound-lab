import { useCallback, useId, useRef } from 'react';
import { applyPitchOffset } from '../domain/modulation';
import type { OscillatorSettings } from '../domain/drone';
import {
  getAmplitudeModulationRange, getOscillatorModulationRange, getOscillatorSliderSpan, OSCILLATOR_MODULATION_PARAMETERS
} from '../domain/oscillator-modulation';
import type { OscillatorModulationParameter, OscillatorModulationRoute } from '../domain/oscillator-modulation';
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
  readonly readOscillatorVolume: (oscillatorId: string) => number | null;
  readonly readOscillatorFrequency: (oscillatorId: string) => number | null;
  readonly getModulationAnalyser: (targetId: string, parameter: OscillatorModulationParameter) => AnalyserNode | null;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
  readonly onRouteChange: (route: OscillatorModulationRoute) => void;
}

export function OscillatorModulationSlider({
  oscillator, effectiveFrequency, oscillators, parameter, routes, sampleRate, playing, getModulationAnalyser, pitchDepthCents, readOscillatorFrequency, amplitudeDepth, readOscillatorVolume,
  disabled, onChange, onRouteChange
}: OscillatorModulationSliderProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const {label, unit, minimum, maximum, step} = OSCILLATOR_MODULATION_PARAMETERS[parameter];
  const span = getOscillatorSliderSpan(parameter);
  const factor = unit === '%' ? 100 : 1;
  const sources = oscillators.map((item, index) => ({id: item.id, name: `OSC ${String(index + 1).padStart(2, '0')}`}))
    .filter(source => source.id !== oscillator.id);
  const route = routes.find(item => item.targetId === oscillator.id && item.parameter === parameter) ?? {
    targetId: oscillator.id, parameter, sourceId: sources[0].id, depth: span / 10, enabled: false
  };
  const baseRange = getOscillatorModulationRange(oscillator, parameter, 0);
  const range = getOscillatorModulationRange({...oscillator, frequencyHz: effectiveFrequency}, parameter,
    route.enabled ? route.depth : 0, sampleRate);
  const samples = useRef(new Float32Array(32));
  const readLiveValue = useCallback(() => {
    if (parameter === 'frequency') return readOscillatorFrequency(oscillator.id);
    if (amplitudeDepth !== undefined) return readOscillatorVolume(oscillator.id);
    const analyser = getModulationAnalyser(oscillator.id, parameter);
    if (!analyser) return null;
    const buffer = samples.current;
    analyser.getFloatTimeDomainData(buffer);
    return range.base + buffer.reduce((total, sample) => total + sample, 0) / buffer.length;
  }, [amplitudeDepth, getModulationAnalyser, oscillator.id, parameter, range.base, readOscillatorFrequency, readOscillatorVolume]);
  const showPreview = route.enabled || pitchDepthCents !== undefined || amplitudeDepth !== undefined;
  const depthCents = pitchDepthCents ?? 0;
  const nyquist = (sampleRate ?? 48000) / 2;
  const bounds: readonly [number, number] = parameter === 'frequency' ? [
    Math.min(nyquist, applyPitchOffset(range.lower, oscillator.detuneCents - depthCents)),
    Math.min(nyquist, applyPitchOffset(range.upper, oscillator.detuneCents + depthCents))
  ] : amplitudeDepth !== undefined ? getAmplitudeModulationRange(range.lower, range.upper, amplitudeDepth) :
    [range.lower, range.upper];

  return <>
    <NumericSlider label={label} unit={unit} displayFactor={factor} min={minimum} max={maximum}
      scale={parameter === 'cutoff' ? 'logarithmic' : parameter === 'volume' ? 'quadratic' : 'linear'}
      step={parameter === 'cutoff' ? 0.1 : parameter === 'volume' ? 0.0001 : step}
      value={baseRange.base} disabled={disabled} onChange={onChange}
      modulationRange={showPreview ? bounds : undefined}
      readLiveValue={playing && showPreview ? readLiveValue : undefined} showLiveValue={parameter === 'frequency' || amplitudeDepth !== undefined}
      action={<button type="button" className="oscillator-modulation-button" data-active={route.enabled}
        aria-label={`${label} modulation`} title={`${label} modulation`} aria-haspopup="dialog" aria-controls={dialogId}
        onClick={() => dialog.current?.showModal()}><span aria-hidden="true">∿</span></button>}/>
    <dialog id={dialogId} ref={dialog} className="oscillator-modulation-dialog" aria-labelledby={`${dialogId}-title`}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="oscillator-modulation-panel">
        <div className="oscillator-modulation-heading">
          <h3 id={`${dialogId}-title`}>{label} MODULATION</h3>
          <button type="button" aria-label="Close modulation settings" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <label className="switch"><input type="checkbox" checked={route.enabled}
          onChange={event => onRouteChange({...route, enabled: event.target.checked})}/> ENABLE MODULATION</label>
        <label>SOURCE OSCILLATOR
          <select value={route.sourceId} onChange={event => onRouteChange({...route, sourceId: event.target.value})}>
            {sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
        </label>
        <NumericSlider label="DEPTH ±" unit="%" displayFactor={100} min={0} max={1} step={0.001}
          value={route.depth / span} onChange={depth => onRouteChange({...route, depth: depth * span})}/>
        {disabled && <p>Enable the low-pass filter to hear this modulation.</p>}
        <p>Follows the source’s volume and amplitude LFO.</p>
      </div>
    </dialog>
  </>;
}
