import { useCallback, useId, useRef } from 'react';
import type { OscillatorSettings } from '../domain/drone';
import {
  defaultModulationDirection, getOscillatorModulationRange, OSCILLATOR_MODULATION_PARAMETERS
} from '../domain/oscillator-modulation';
import type { OscillatorModulationDirection, OscillatorModulationParameter, OscillatorModulationRoute } from '../domain/oscillator-modulation';
import { NumericSlider } from './NumericSlider';

interface OscillatorModulationSliderProps {
  readonly oscillator: OscillatorSettings;
  readonly effectiveFrequency: number;
  readonly oscillators: readonly OscillatorSettings[];
  readonly parameter: OscillatorModulationParameter;
  readonly routes: readonly OscillatorModulationRoute[];
  readonly sampleRate?: number;
  readonly playing: boolean;
  readonly getModulationAnalyser: (targetId: string, parameter: OscillatorModulationParameter) => AnalyserNode | null;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
  readonly onRouteChange: (route: OscillatorModulationRoute) => void;
}

export function OscillatorModulationSlider({
  oscillator, effectiveFrequency, oscillators, parameter, routes, sampleRate, playing, getModulationAnalyser, disabled, onChange, onRouteChange
}: OscillatorModulationSliderProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const {label, unit, minimum, maximum, step, maximumDepth, defaultDepth} = OSCILLATOR_MODULATION_PARAMETERS[parameter];
  const factor = unit === '%' ? 100 : 1;
  const sources = oscillators.map((item, index) => ({id: item.id, name: `OSC ${String(index + 1).padStart(2, '0')}`}))
    .filter(source => source.id !== oscillator.id);
  const route = routes.find(item => item.targetId === oscillator.id && item.parameter === parameter) ?? {
    targetId: oscillator.id, parameter, sourceId: sources[0].id, depth: defaultDepth, enabled: false
  };
  const direction = route.direction ?? defaultModulationDirection(parameter);
  const baseRange = getOscillatorModulationRange(oscillator, parameter, 0);
  const range = getOscillatorModulationRange({...oscillator, frequencyHz: effectiveFrequency}, parameter, route.depth,
    sampleRate, direction);
  const getAnalyser = useCallback(() => getModulationAnalyser(oscillator.id, parameter),
    [getModulationAnalyser, oscillator.id, parameter]);

  return <>
    <NumericSlider label={label} unit={unit} displayFactor={factor} min={minimum} max={maximum} step={step}
      value={baseRange.base} disabled={disabled} onChange={onChange}
      modulationRange={route.enabled ? [range.lower, range.upper] : undefined}
      modulationBase={range.base} getModulationAnalyser={playing && route.enabled ? getAnalyser : undefined}
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
        <label>DIRECTION
          <select value={direction} onChange={event => onRouteChange({...route, direction: event.target.value as OscillatorModulationDirection})}>
            <option value="increase">Increase (+)</option>
            <option value="decrease">Decrease (−)</option>
          </select>
        </label>
        <NumericSlider label="DEPTH" unit={unit} displayFactor={factor} min={0} max={maximumDepth} step={step}
          value={route.depth} onChange={depth => onRouteChange({...route, depth})}/>
        {disabled && <p>Enable the low-pass filter to hear this modulation.</p>}
        <p>Follows the source’s volume and amplitude LFO.</p>
      </div>
    </dialog>
  </>;
}
