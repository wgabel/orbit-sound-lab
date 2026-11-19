import { MAX_SHELF_FREQUENCY_HZ, MAX_SHELF_GAIN_DECIBELS, MIN_SHELF_FREQUENCY_HZ } from '../domain/drone';
import type { DroneMixSettings } from '../domain/drone';
import type { DroneLayerId } from '../domain/drone-layers';
import { NumericSlider } from './NumericSlider';

interface DroneMixControlsProps {
  readonly layerId: DroneLayerId;
  readonly settings: DroneMixSettings;
  readonly onChange: (settings: DroneMixSettings) => void;
}

const shelfControls = [
  {key: 'lowShelf', label: 'Low shelf'},
  {key: 'highShelf', label: 'High shelf'}
] as const;

export function DroneMixControls({layerId, settings, onChange}: DroneMixControlsProps) {
  const {noise, filter, reverb} = settings;

  return <section className="drone-mix" aria-label={`Drone ${layerId} mix`}>
    <h2>DRONE {layerId} MIX</h2>
    <div className="drone-mix-controls">
      <div>
        <label className="switch">
          <input type="checkbox" checked={noise.enabled}
            onChange={event => onChange({...settings, noise: {...noise, enabled: event.target.checked}})}/>
          WHITE NOISE
        </label>
        <NumericSlider label="NOISE LEVEL" unit="%" displayFactor={100} min={0} max={1} step={0.01}
          value={noise.volume} onChange={volume => onChange({...settings, noise: {...noise, volume}})}/>
      </div>
      <div>
        <label className="switch">
          <input type="checkbox" checked={filter.enabled}
            onChange={event => onChange({...settings, filter: {...filter, enabled: event.target.checked}})}/>
          LAYER LOW-PASS
        </label>
        <NumericSlider label="LAYER CUTOFF" unit="Hz" min={20} max={20000} step={0.1} scale="logarithmic" disabled={!filter.enabled}
          value={filter.cutoffHz} onChange={cutoffHz => onChange({...settings, filter: {...filter, cutoffHz}})}/>
      </div>
      <div>
        <label className="switch">
          <input type="checkbox" checked={reverb.enabled}
            onChange={event => onChange({...settings, reverb: {...reverb, enabled: event.target.checked}})}/>
          REVERB
        </label>
        <NumericSlider label="REVERB MIX" unit="%" displayFactor={100} min={0} max={1} step={0.01}
          value={reverb.mix} onChange={mix => onChange({...settings, reverb: {...reverb, mix}})}/>
      </div>
    </div>
    <div className="drone-mix-controls drone-shelf-controls">
      {shelfControls.map(({key, label}) => {
        const shelf = settings[key];
        return <div key={key}>
          <h3>{label}</h3>
          <NumericSlider label={`${label} frequency`} unit="Hz" min={MIN_SHELF_FREQUENCY_HZ} max={MAX_SHELF_FREQUENCY_HZ}
            step={1} scale="logarithmic" value={shelf.frequencyHz}
            onChange={frequencyHz => onChange({...settings, [key]: {...shelf, frequencyHz}})}/>
          <NumericSlider label={`${label} gain`} unit="dB" min={-MAX_SHELF_GAIN_DECIBELS} max={MAX_SHELF_GAIN_DECIBELS}
            step={0.5} value={shelf.gainDecibels}
            onChange={gainDecibels => onChange({...settings, [key]: {...shelf, gainDecibels}})}/>
        </div>;
      })}
    </div>
  </section>;
}
