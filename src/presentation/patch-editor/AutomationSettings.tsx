import type { PatchAutomation } from '../../domain/patch-automation';
import { applyHarmonicsPreset, HARMONICS_GROUPS, readHarmonicsPresetId } from '../../domain/patch-harmonics';
import { applySmoothWavePreset, readSmoothWavePresetId, SMOOTH_WAVE_PRESETS } from '../../domain/patch-smooth-waves';
import { NumericSlider } from '../NumericSlider';

export function AutomationSettings({settings, onChange}: {settings: PatchAutomation; onChange(settings: PatchAutomation): void}) {
  const harmonics = readHarmonicsPresetId(settings);
  const smoothWave = readSmoothWavePresetId(settings);
  function updatePoint(index: number, value: number) {
    const points = settings.points.map((point, pointIndex) => pointIndex === index ? {...point,value} : point);
    if (settings.shape === 'steps' && index === points.length - 2) {
      points[points.length - 1] = {...points[points.length - 1],value};
    }
    onChange({...settings,points});
  }
  return <>
    <div className="patch-fields">
      <label>Shape<select value={settings.shape} onChange={event =>
        onChange({...settings,shape:event.target.value as PatchAutomation['shape']})}>
        <option value="steps">Steps</option><option value="curve">Curve</option>
        <option value="smoothCurve">Smooth curve</option>
        <option value="sine">Sine LFO</option><option value="square">Square LFO</option>
      </select></label>
      <label>Harmonics<select value={harmonics} onChange={event =>
        onChange(applyHarmonicsPreset(settings,event.target.value))}>
        <option value="" disabled>Choose a preset</option>
        {HARMONICS_GROUPS.map(group => <optgroup key={group.label} label={group.label}>
          {group.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </optgroup>)}
      </select></label>
      <label>Smooth waves<select value={smoothWave}
        onChange={event => onChange(applySmoothWavePreset(settings,event.target.value))}>
        <option value="" disabled>Choose a preset</option>
        {SMOOTH_WAVE_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
      </select></label>
      <label>Playback<select value={settings.mode} onChange={event =>
        onChange({...settings,mode:event.target.value as PatchAutomation['mode']})}>
        <option value="loop">Loop</option><option value="once">Play once, hold end</option>
      </select></label>
      <NumericSlider label="Duration" unit="s" min={0.05} max={60} step={0.05}
        value={settings.duration} onChange={duration => onChange({...settings,duration})}/>
      {settings.shape === 'steps' && <NumericSlider label="Glide" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={settings.glide} onChange={glide => onChange({...settings,glide})}/>}
    </div>
    {harmonics && <p>For tuned pitches, map a cable to Wave Frequency across one octave, such as 110–220 Hz.</p>}
    {(settings.shape === 'steps' || settings.shape === 'curve' || settings.shape === 'smoothCurve') && <div className="patch-fields patch-points">
      {settings.points.slice(0, settings.shape === 'steps' ? -1 : undefined).map((point,index) =>
        <NumericSlider key={point.position} label={`${settings.shape === 'steps' ? 'Step' : 'Point'} ${index+1} · ${+(point.position * settings.duration).toFixed(2)} s`}
          unit="%" displayFactor={100} min={0} max={1} step={0.01} value={point.value} onChange={value => updatePoint(index,value)}/>)}
    </div>}
  </>;
}
