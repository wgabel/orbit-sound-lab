import { useId, useState } from 'react';
import { LFO_WAVEFORM_LABELS } from './lfo-waveform-labels';
import { AMPLITUDE_LFO_CENTER, DEFAULT_SHAPE_LFO_DEPTH, LOW_FREQUENCY_OSCILLATOR_WAVEFORMS, LFO_MAXIMUM_RATE_HZ, LFO_MINIMUM_RATE_HZ } from '../domain/modulation';
import type { LowFrequencyOscillatorSettings, LowFrequencyOscillatorWaveform } from '../domain/modulation';
import { LfoCycleInput } from './LfoCycleInput';
import { NumericSlider } from './NumericSlider';

const DESTINATION_LABELS = {
  amplitude: 'Amplitude',
  pitch: 'Pitch',
  filterCutoff: 'Cutoff',
  shape: 'Shape'
} as const;

interface OscillatorLfoControlsProps {
  readonly modulation: LowFrequencyOscillatorSettings;
  readonly onChange: (settings: LowFrequencyOscillatorSettings) => void;
}

export function OscillatorLfoControls({modulation, onChange}: OscillatorLfoControlsProps) {
  const {destination, enabled, frequencyHz, depthCents, depthAmplitude, depthShape = DEFAULT_SHAPE_LFO_DEPTH, depthHz, waveform, sync = false, phaseDegrees = 0} = modulation;
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const destinationLabel = DESTINATION_LABELS[destination];
  const label = `${destinationLabel} LFO`;

  return <div className="oscillator-lfo-disclosure">
    <div className="oscillator-lfo-header">
      <button type="button" className="oscillator-lfo-expand" aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setExpanded(value => !value)}>{label}</button>
      <label className="oscillator-lfo-enable">
        <input type="checkbox" aria-label={`Enable ${label}`} checked={enabled}
          onChange={event => onChange({...modulation, enabled: event.target.checked})}/>
      </label>
    </div>
    <div className="lfo-destination" id={panelId} hidden={!expanded}>
      <label className="oscillator-lfo-waveform">Waveform
        <select aria-label="LFO waveform" disabled={!enabled} value={waveform}
          onChange={event => onChange({...modulation, waveform: event.target.value as LowFrequencyOscillatorWaveform})}>
          {LOW_FREQUENCY_OSCILLATOR_WAVEFORMS.map(option => <option key={option} value={option}>
            {LFO_WAVEFORM_LABELS[option]}
          </option>)}
        </select>
      </label>
      {waveform === 'smoothRandom' && <p className="pitch-lfo-detail">Moves to a new random target each cycle.</p>}
      <NumericSlider label="RATE" unit="Hz" min={LFO_MINIMUM_RATE_HZ} max={LFO_MAXIMUM_RATE_HZ} step={0.01}
        disabled={!enabled} value={frequencyHz} onChange={value => onChange({...modulation, frequencyHz: value})}/>
      <LfoCycleInput rateHz={frequencyHz}
        destination={destinationLabel}
        disabled={!enabled} onRateChange={value => onChange({...modulation, frequencyHz: value})}/>
      <label className="switch">
        <input type="checkbox" checked={sync} disabled={!enabled}
          onChange={event => onChange({...modulation, sync: event.target.checked})}/>
        {' '}Sync
      </label>
      {sync && <>
        <NumericSlider label="PHASE" unit="°" min={0} max={360} step={1} disabled={!enabled}
          value={phaseDegrees} onChange={value => onChange({...modulation, phaseDegrees: value})}/>
        <p className="pitch-lfo-detail">Match the Rate of the LFOs you want to sync.</p>
      </>}
      {destination === 'pitch' ? <>
        <NumericSlider label="DEPTH" unit="cents" min={0} max={300} step={0.1}
          disabled={!enabled} value={depthCents} onChange={value => onChange({...modulation, depthCents: value})}/>
        {depthCents >= 100 && <span className="pitch-lfo-detail">±{Number((depthCents / 100).toFixed(3))} semitones</span>}
      </> : destination === 'amplitude' ? <NumericSlider label="DEPTH" unit="%" displayFactor={100 / AMPLITUDE_LFO_CENTER}
        min={0} max={AMPLITUDE_LFO_CENTER} step={AMPLITUDE_LFO_CENTER / 10000} scale="quadratic"
        disabled={!enabled} value={depthAmplitude} onChange={value => onChange({...modulation, depthAmplitude: value})}/>
      : destination === 'shape' ? <NumericSlider label="DEPTH ±" unit="pp" displayFactor={100}
        min={0} max={1} step={0.001} disabled={!enabled} value={depthShape}
        onChange={value => onChange({...modulation, depthShape: value})}/>
      : <NumericSlider label="DEPTH" unit="Hz" min={0} max={5000} step={0.1} scale="quadratic"
        disabled={!enabled} value={depthHz} onChange={value => onChange({...modulation, depthHz: value})}/>}
    </div>
  </div>;
}
