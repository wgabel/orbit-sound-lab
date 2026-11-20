import { CHORD_TYPES, getNoteName, MAXIMUM_CHORD_ROOT, MINIMUM_CHORD_ROOT } from '@domain/chord';
import type { ChordType } from '@domain/chord';
import { MAXIMUM_CHORD_STEPS } from '@domain/chord-progression';
import type { ChordProgression, ChordStep } from '@domain/chord-progression';
import { NumericSlider } from '@presentation/NumericSlider';

const roots = Array.from({length:MAXIMUM_CHORD_ROOT-MINIMUM_CHORD_ROOT+1},(_,index) => index+MINIMUM_CHORD_ROOT);

export function ChordProgressionSettings({settings,onChange}: {
  settings: ChordProgression;
  onChange(settings: ChordProgression): void;
}) {
  function updateStep(index: number, step: ChordStep) {
    onChange({...settings,steps:settings.steps.map((current,position) => position === index ? step : current)});
  }

  function moveStep(index: number, destination: number) {
    const steps = [...settings.steps];
    [steps[index],steps[destination]] = [steps[destination],steps[index]];
    onChange({...settings,steps});
  }

  return <>
    <p>Connect Chords to a Chord Generator. Each step sets its root and chord quality.</p>
    <div className="patch-fields">
      <NumericSlider label="Time per chord" unit="s" min={0.1} max={30} step={0.1} value={settings.stepSeconds}
        onChange={stepSeconds => onChange({...settings,stepSeconds})}/>
      <label>Playback<select value={settings.mode}
        onChange={event => onChange({...settings,mode:event.target.value === 'once' ? 'once' : 'loop'})}>
        <option value="loop">Loop</option><option value="once">Play once, hold last chord</option>
      </select></label>
    </div>
    <ol className="patch-chord-steps">
      {settings.steps.map((step,index) => <li key={index}>
        <label>Root<select aria-label={`Step ${index+1} root`} value={step.rootNote}
          onChange={event => updateStep(index,{...step,rootNote:Number(event.target.value)})}>
          {roots.map(note => <option key={note} value={note}>{getNoteName(note,true)}</option>)}
        </select></label>
        <label>Quality<select aria-label={`Step ${index+1} quality`} value={step.chord}
          onChange={event => updateStep(index,{...step,chord:event.target.value as ChordType})}>
          {CHORD_TYPES.map(chord => <option key={chord} value={chord}>{chord}</option>)}
        </select></label>
        <div className="patch-actions">
          <button type="button" aria-label={`Move step ${index+1} earlier`} disabled={index === 0}
            onClick={() => moveStep(index,index-1)}>↑</button>
          <button type="button" aria-label={`Move step ${index+1} later`} disabled={index === settings.steps.length-1}
            onClick={() => moveStep(index,index+1)}>↓</button>
          <button type="button" aria-label={`Remove step ${index+1}`} disabled={settings.steps.length === 1}
            onClick={() => onChange({...settings,steps:settings.steps.filter((_,position) => position !== index)})}>Remove</button>
        </div>
      </li>)}
    </ol>
    <button type="button" disabled={settings.steps.length >= MAXIMUM_CHORD_STEPS}
      onClick={() => onChange({...settings,steps:[...settings.steps,settings.steps[settings.steps.length-1]]})}>Add chord step</button>
  </>;
}
