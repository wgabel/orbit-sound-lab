import { MAXIMUM_REVERB_DECAY_SECONDS, MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS, MINIMUM_REVERB_DECAY_SECONDS,
  REVERB_PRESETS } from '@domain/reverb';
import type { ReverbSettings } from '@domain/reverb';
import { NumericSlider } from './NumericSlider';

interface ReverbControlsProps {
  readonly settings: ReverbSettings;
  onChange(settings: ReverbSettings): void;
  onPreset?(settings: ReverbSettings): void;
}

export function ReverbControls({settings, onChange, onPreset = onChange}: ReverbControlsProps) {
  return <div className="reverb-controls">
    <label>Reverb preset
      <select value="" onChange={event => {
        const preset = REVERB_PRESETS.find(item => item.name === event.target.value);
        if (preset) onPreset(preset.settings);
      }}>
        <option value="" disabled>Choose a space</option>
        {REVERB_PRESETS.map(preset => <option key={preset.name}>{preset.name}</option>)}
      </select>
    </label>
    <div className="reverb-controls-grid">
      <NumericSlider label="Wet Mix" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={settings.mix} onChange={mix => onChange({...settings,mix})}/>
      <NumericSlider label="Decay" unit="s" min={MINIMUM_REVERB_DECAY_SECONDS} max={MAXIMUM_REVERB_DECAY_SECONDS} step={0.05}
        value={settings.decaySeconds} onChange={decaySeconds => onChange({...settings,decaySeconds})}/>
      <NumericSlider label="Pre-delay" unit="ms" min={0} max={MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS} step={1}
        value={settings.preDelayMilliseconds} onChange={preDelayMilliseconds => onChange({...settings,preDelayMilliseconds})}/>
      <NumericSlider label="Damping" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={settings.damping} onChange={damping => onChange({...settings,damping})}/>
    </div>
  </div>;
}
