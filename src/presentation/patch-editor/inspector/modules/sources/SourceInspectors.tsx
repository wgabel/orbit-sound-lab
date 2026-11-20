import { DEFAULT_CYCLE_ENVELOPE } from '@domain/cycle-envelope';
import { CHORD_TYPES, getChordMidiNotes, getMaximumChordInversion, getNoteName,
  MAXIMUM_CHORD_ROOT, MINIMUM_CHORD_ROOT } from '@domain/chord';
import type { ChordType } from '@domain/chord';
import { OSCILLATOR_WAVEFORMS, supportsOscillatorShape } from '@domain/drone';
import type { OscillatorWaveform } from '@domain/drone';
import type { PatchModule } from '@domain/patch';
import { CycleEnvelopeControls } from '@presentation/CycleEnvelopeControls';
import { NumericSlider } from '@presentation/NumericSlider';
import type { PatchModuleInspectorProps } from '../../module-inspector-contracts';

type ChordModule = Extract<PatchModule,{kind:'chord'}>;
type WaveModule = Extract<PatchModule,{kind:'wave'}>;
type DroneModule = Extract<PatchModule,{kind:'drone'}>;

export function ChordInspector({module,onChange}: PatchModuleInspectorProps<ChordModule>) {
  return <div className="patch-fields">
    <label>Root note<select value={module.settings.rootNote} onChange={event =>
      onChange({...module,settings:{...module.settings,rootNote:Number(event.target.value)}})}>
      {Array.from({length:MAXIMUM_CHORD_ROOT-MINIMUM_CHORD_ROOT+1},(_,index) => index+MINIMUM_CHORD_ROOT).map(note=>
        <option key={note} value={note}>{getNoteName(note)}</option>)}
    </select></label>
    <label>Chord type<select value={module.settings.chord} onChange={event => {
      const chord = event.target.value as ChordType;
      const inversion = Math.min(module.settings.inversion,getMaximumChordInversion(chord));
      onChange({...module,settings:{...module.settings,chord,inversion}});
    }}>
      {CHORD_TYPES.map(chord=><option key={chord} value={chord}>{chord}</option>)}
    </select></label>
    <NumericSlider label="Inversion" unit="" min={0} max={getMaximumChordInversion(module.settings.chord)} step={1}
      value={module.settings.inversion} onChange={inversion=>onChange({...module,settings:{...module.settings,inversion}})}/>
    <NumericSlider label="Octave shift" unit="oct" min={-1} max={1} step={1}
      value={module.settings.octave} onChange={octave=>onChange({...module,settings:{...module.settings,octave}})}/>
    <NumericSlider label="Voicing spread" unit="oct" min={0} max={1} step={1}
      value={module.settings.spread} onChange={spread=>onChange({...module,settings:{...module.settings,spread}})}/>
    <p>Notes: {getChordMidiNotes(module.settings).map(note => getNoteName(note)).join(' · ')}</p>
  </div>;
}

export function WaveInspector({module,onChange}: PatchModuleInspectorProps<WaveModule>) {
  return <div className="patch-fields">
    <label>Waveform<select value={module.settings.waveform} onChange={event =>
      onChange({...module,settings:{...module.settings,waveform:event.target.value as OscillatorWaveform}})}>
      {OSCILLATOR_WAVEFORMS.map(waveform => <option value={waveform} key={waveform}>
        {waveform.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter => letter.toUpperCase())}</option>)}
    </select></label>
    <NumericSlider label="Base frequency" unit="Hz" min={40} max={880} step={0.1} value={module.settings.frequency}
      onChange={frequency => onChange({...module,settings:{...module.settings,frequency}})}/>
    {supportsOscillatorShape(module.settings.waveform) && <NumericSlider
      label={module.settings.waveform === 'cycleEnvelope' ? 'Amount' : 'Base shape'} unit="%" displayFactor={100}
      min={0} max={1} step={0.01} value={module.settings.shape}
      onChange={shape => onChange({...module,settings:{...module.settings,shape}})}/>}
    {module.settings.waveform === 'cycleEnvelope' && <CycleEnvelopeControls
      envelope={module.settings.cycleEnvelope ?? DEFAULT_CYCLE_ENVELOPE}
      amount={module.settings.shape}
      onChange={cycleEnvelope => onChange({...module,settings:{...module.settings,cycleEnvelope}})}/>}
  </div>;
}

export function DroneInspector({module}: PatchModuleInspectorProps<DroneModule>) {
  return <p>{module.settings.voice.oscillators.filter(oscillator => oscillator.enabled).length} active oscillator voices</p>;
}
