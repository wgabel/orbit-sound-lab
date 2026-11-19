import type { DroneMixSettings } from '../domain/drone';
import type { DroneLayerId } from '../domain/drone-layers';
import { ShelfEqControls } from './ShelfEqControls';
import { NumericSlider } from './NumericSlider';

interface DroneMixControlsProps {
  readonly layerId: DroneLayerId;
  readonly settings: DroneMixSettings;
  readonly sampleRate?: number;
  readonly onChange: (settings: DroneMixSettings) => void;
}

export function DroneMixControls({layerId, settings, sampleRate, onChange}: DroneMixControlsProps) {
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
    <ShelfEqControls settings={settings} sampleRate={sampleRate} onChange={shelves => onChange({...settings,...shelves})}/>
  </section>;
}
