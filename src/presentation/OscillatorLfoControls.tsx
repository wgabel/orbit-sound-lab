import { AMPLITUDE_LFO_CENTER, LOW_FREQUENCY_OSCILLATOR_WAVEFORMS, LFO_MAXIMUM_RATE_HZ, LFO_MINIMUM_RATE_HZ } from '../domain/modulation';
import type { LowFrequencyOscillatorSettings, LowFrequencyOscillatorWaveform } from '../domain/modulation';
import { LfoCycleInput } from './LfoCycleInput';
import { NumericSlider } from './NumericSlider';

const DESTINATION_LABELS = {
  amplitude: 'Amplitude LFO',
  pitch: 'Pitch LFO',
  filterCutoff: 'Cutoff LFO'
} as const;

interface OscillatorLfoControlsProps {
  readonly modulation: LowFrequencyOscillatorSettings;
  readonly onChange: (settings: LowFrequencyOscillatorSettings) => void;
}

export function OscillatorLfoControls({modulation, onChange}: OscillatorLfoControlsProps) {
  const {destination, enabled, frequencyHz, depthCents, depthAmplitude, depthHz, waveform, sync = false, phaseDegrees = 0} = modulation;
  const label = DESTINATION_LABELS[destination];

  return <details className="oscillator-lfo-disclosure">
    <summary>
      <span>{label}</span>
      <span className="oscillator-lfo-state" data-active={enabled}>{enabled ? 'ON' : 'OFF'}</span>
    </summary>
    <div className="lfo-destination">
      <label className="switch">
        <input type="checkbox" checked={enabled} onChange={event => onChange({...modulation, enabled: event.target.checked})}/>
        {' '}Enable {label}
      </label>
      <NumericSlider label="RATE" unit="Hz" min={LFO_MINIMUM_RATE_HZ} max={LFO_MAXIMUM_RATE_HZ} step={0.01}
        disabled={!enabled} value={frequencyHz} onChange={value => onChange({...modulation, frequencyHz: value})}/>
      <LfoCycleInput rateHz={frequencyHz}
        destination={destination === 'pitch' ? 'Pitch' : destination === 'amplitude' ? 'Amplitude' : 'Cutoff'}
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
      : <NumericSlider label="DEPTH" unit="Hz" min={0} max={5000} step={0.1} scale="quadratic"
        disabled={!enabled} value={depthHz} onChange={value => onChange({...modulation, depthHz: value})}/>}
      <label>LFO WAVEFORM
        <select disabled={!enabled} value={waveform}
          onChange={event => onChange({...modulation, waveform: event.target.value as LowFrequencyOscillatorWaveform})}>
          {LOW_FREQUENCY_OSCILLATOR_WAVEFORMS.map(option => <option key={option} value={option}>
            {option === 'smoothRandom' ? 'Smooth Random' : option[0].toUpperCase() + option.slice(1)}
          </option>)}
        </select>
      </label>
      {waveform === 'smoothRandom' && <p className="pitch-lfo-detail">Moves to a new random target each cycle.</p>}
    </div>
  </details>;
}
