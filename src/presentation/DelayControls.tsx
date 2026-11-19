import type { DelaySettings } from '../domain/delay';
import { NumericSlider } from './NumericSlider';

export function DelayControls({settings,onChange,disabled}: {
  readonly settings: DelaySettings;
  readonly disabled?: boolean;
  onChange(settings: DelaySettings): void;
}) {
  return <div className="delay-controls effect-control-grid">
    <NumericSlider label="Time" unit="s" min={0.05} max={2} step={0.01} disabled={disabled}
      value={settings.timeSeconds} onChange={timeSeconds => onChange({...settings,timeSeconds})}/>
    <NumericSlider label="Feedback" unit="%" displayFactor={100} min={0} max={0.85} step={0.01} disabled={disabled}
      value={settings.feedback} onChange={feedback => onChange({...settings,feedback})}/>
    <NumericSlider label="Wet mix" unit="%" displayFactor={100} min={0} max={1} step={0.01} disabled={disabled}
      value={settings.mix} onChange={mix => onChange({...settings,mix})}/>
  </div>;
}
