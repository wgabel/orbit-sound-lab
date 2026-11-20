import { DEFAULT_AUTOMATION_STEP_ENVELOPE, MAXIMUM_AUTOMATION_DURATION, MINIMUM_AUTOMATION_DURATION, setAutomationEnvelopeTime } from '@domain/patch/automation';
import type { AutomationStepEnvelope, PatchAutomation } from '@domain/patch/automation';
import { applyHarmonicsPreset, HARMONICS_GROUPS, readHarmonicsPresetId } from '@domain/patch/harmonics';
import { applySmoothWavePreset, readSmoothWavePresetId, SMOOTH_WAVE_PRESETS } from '@domain/patch/smooth-waves';
import { NumericSlider } from '@presentation/NumericSlider';

export function AutomationSettings({settings, onChange}: {settings: PatchAutomation; onChange(settings: PatchAutomation): void}) {
  const harmonics = readHarmonicsPresetId(settings);
  const smoothWave = readSmoothWavePresetId(settings);
  const stepEnvelope = settings.stepEnvelope ?? DEFAULT_AUTOMATION_STEP_ENVELOPE;
  const enveloped = settings.shape === 'steps' && stepEnvelope.enabled;

  function updateEnvelope(changes: Partial<AutomationStepEnvelope>) {
    onChange({...settings,stepEnvelope:{...stepEnvelope,...changes}});
  }

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
        <option value="loop">Loop</option><option value="once">{enveloped ? 'Play once, release' : 'Play once, hold end'}</option>
      </select></label>
      <NumericSlider label="Duration" unit="s" min={MINIMUM_AUTOMATION_DURATION} max={MAXIMUM_AUTOMATION_DURATION} step={0.05}
        value={settings.duration} onChange={duration => onChange({...settings,duration})}/>
      {settings.shape === 'steps' && !enveloped && <NumericSlider label="Glide" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={settings.glide} onChange={glide => onChange({...settings,glide})}/>}
    </div>
    {settings.shape === 'steps' && <fieldset className="patch-step-envelope">
      <legend>Step envelope (ADSR)</legend>
      <label><input type="checkbox" checked={stepEnvelope.enabled}
        onChange={event => updateEnvelope({enabled:event.target.checked})}/> Enable step envelope</label>
      {enveloped && <>
        <div className="patch-fields">
          <NumericSlider label="Attack" unit="%" displayFactor={100} min={0} max={1} step={0.01}
            value={stepEnvelope.attack} onChange={value => updateEnvelope(setAutomationEnvelopeTime(stepEnvelope,'attack',value))}/>
          <NumericSlider label="Decay" unit="%" displayFactor={100} min={0} max={1} step={0.01}
            value={stepEnvelope.decay} onChange={value => updateEnvelope(setAutomationEnvelopeTime(stepEnvelope,'decay',value))}/>
          <NumericSlider label="Sustain" unit="%" displayFactor={100} min={0} max={1} step={0.01}
            value={stepEnvelope.sustain} onChange={sustain => updateEnvelope({sustain})}/>
          <NumericSlider label="Release" unit="%" displayFactor={100} min={0} max={1} step={0.01}
            value={stepEnvelope.release} onChange={value => updateEnvelope(setAutomationEnvelopeTime(stepEnvelope,'release',value))}/>
        </div>
        <p>Attack, decay and release share the step time. Sustain sets how much of the step level is held.</p>
      </>}
    </fieldset>}
    {harmonics && !enveloped && <p>For tuned pitches, map a cable to Wave Frequency across one octave, such as 110–220 Hz.</p>}
    {(settings.shape === 'steps' || settings.shape === 'curve' || settings.shape === 'smoothCurve') && <div className="patch-fields patch-points">
      {settings.points.slice(0, settings.shape === 'steps' ? -1 : undefined).map((point,index) =>
        <NumericSlider key={point.position} label={`${settings.shape === 'steps' ? 'Step' : 'Point'} ${index+1} · ${+(point.position * settings.duration).toFixed(2)} s`}
          unit="%" displayFactor={100} min={0} max={1} step={0.01} value={point.value} onChange={value => updatePoint(index,value)}/>)}
    </div>}
  </>;
}
