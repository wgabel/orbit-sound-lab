import { ReverbControls } from '../ReverbControls';
import { ChordProgressionSettings } from './ChordProgressionSettings';
import { AutomationSettings } from './AutomationSettings';
import { CHORD_TYPES, getChordMidiNotes, getMaximumChordInversion, getNoteName, MAXIMUM_CHORD_ROOT, MINIMUM_CHORD_ROOT } from '../../domain/chord';
import type { ChordType } from '../../domain/chord';
import { PatchLfoSettings } from './PatchLfoSettings';
import { OSCILLATOR_WAVEFORMS, supportsOscillatorShape } from '../../domain/drone';
import type { OscillatorWaveform } from '../../domain/drone';
import { DRONE_LAYER_IDS } from '../../domain/drone-layers';
import type { DroneLayerId } from '../../domain/drone-layers';
import { ShelfEqControls } from '../ShelfEqControls';
import { getPatchPort, getPatchModuleLabel } from '../../domain/patch';
import type { CableMapping, Patch, PatchCable, PatchDrone, PatchModule } from '../../domain/patch';
import type { PatchAutomation } from '../../domain/patch-automation';
import type { PatchSelection } from './PatchCanvas';
import { NumericSlider } from '../NumericSlider';
import { AutomationPresetLibrary } from './AutomationPresetLibrary';
import { DroneNodePresets } from './DroneNodePresets';

interface InspectorProps {
  readonly patch: Patch;
  readonly sampleRate?: number;
  readonly selection: PatchSelection | null;
  onCopyDrone(module: PatchDrone, layerId: DroneLayerId): void;
  onModule(module: PatchModule): void;
  onMapping(id: string, mapping: CableMapping): void;
  onRemove(selection: PatchSelection): void;
}

function ModuleSettings({module, sampleRate, onChange}: {module: PatchModule; sampleRate?: number; onChange(module: PatchModule): void}) {
  switch (module.kind) {
    case 'chordProgression': return <ChordProgressionSettings settings={module.settings}
      onChange={settings => onChange({...module,settings})}/>;
    case 'chord': return <div className="patch-fields">
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
    case 'lfo': return <PatchLfoSettings settings={module.settings} onChange={settings => onChange({...module,settings})}/>;
    case 'wave': return <div className="patch-fields">
      <label>Waveform<select value={module.settings.waveform} onChange={event =>
        onChange({...module,settings:{...module.settings,waveform:event.target.value as OscillatorWaveform}})}>
        {OSCILLATOR_WAVEFORMS.map(waveform => <option value={waveform} key={waveform}>
          {waveform.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter => letter.toUpperCase())}</option>)}
      </select></label>
      <NumericSlider label="Base frequency" unit="Hz" min={40} max={880} step={0.1} value={module.settings.frequency}
        onChange={frequency => onChange({...module,settings:{...module.settings,frequency}})}/>
      {supportsOscillatorShape(module.settings.waveform) && <NumericSlider label="Base shape" unit="%" displayFactor={100}
        min={0} max={1} step={0.01} value={module.settings.shape} onChange={shape => onChange({...module,settings:{...module.settings,shape}})}/>}
    </div>;
    case 'pitchShift': return <div className="patch-fields">
      <NumericSlider label="Transpose" unit="st" min={-24} max={24} step={1}
        value={module.settings.semitones} onChange={semitones => onChange({...module,settings:{...module.settings,semitones}})}/>
      <NumericSlider label="Fine tune" unit="cents" min={-100} max={100} step={1}
        value={module.settings.cents} onChange={cents => onChange({...module,settings:{...module.settings,cents}})}/>
      <p>Connect Automation or LFO to Pitch to move the transpose setting. Fine tune is added to the automated value.</p>
    </div>;
    case 'filter': return <div className="patch-fields">
      <NumericSlider label="Base cutoff" unit="Hz" min={40} max={6000} step={1} value={module.settings.cutoff}
        onChange={cutoff => onChange({...module,settings:{...module.settings,cutoff}})}/>
      <NumericSlider label="Base resonance" unit="Q" min={0.1} max={12} step={0.1} value={module.settings.resonance}
        onChange={resonance => onChange({...module,settings:{...module.settings,resonance}})}/>
    </div>;
    case 'reverb': return <ReverbControls settings={module.settings}
      onChange={settings => onChange({...module,settings})}/>;
    case 'shelfEq': return <ShelfEqControls settings={module.settings} sampleRate={sampleRate}
      onChange={settings => onChange({...module,settings})}/>;
    case 'crossfader': return <>
      <div className="patch-fields">
        <NumericSlider label="Blend" unit="%" displayFactor={100} min={0} max={1} step={0.01}
          value={module.settings.blend} onChange={blend => onChange({...module,settings:{blend}})}/>
      </div>
      <p>0% plays Audio A, 50% blends both, and 100% plays Audio B.</p>
    </>;
    case 'mixer': return <div className="patch-fields">
      <NumericSlider label="Level A" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={module.settings.levelA} onChange={levelA => onChange({...module,settings:{...module.settings,levelA}})}/>
      <NumericSlider label="Level B" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={module.settings.levelB} onChange={levelB => onChange({...module,settings:{...module.settings,levelB}})}/>
    </div>;
    case 'oscilloscope': return <p>Connect an audio signal to inspect it. Audio out passes it through.</p>;
    case 'gain':
    case 'output': return <div className="patch-fields">
      <NumericSlider label="Base level" unit="%" displayFactor={100} min={0} max={1} step={0.01} value={module.settings.level}
        onChange={level => onChange({...module,settings:{level}})}/>
    </div>;
    case 'automation': {
      const update = (settings: PatchAutomation) => onChange({...module,settings});
      return <>
        <AutomationSettings settings={module.settings} onChange={update}/>
        <AutomationPresetLibrary key={module.id} settings={module.settings} onLoad={update}/>
      </>;
    }
    case 'drone': return <p>{module.settings.voice.oscillators.filter(oscillator => oscillator.enabled).length} active oscillator voices</p>;
  }
}

function CableSettings({patch, cable, onChange}: {patch: Patch; cable: PatchCable; onChange(mapping: CableMapping): void}) {
  const port = getPatchPort(patch,cable.destination);
  const mapping = cable.mapping;
  if (port?.signal === 'chords') return <p>Each step changes the generator’s root and chord quality.</p>;
  if (!port?.parameter || !mapping) return <p>This cable carries audio.</p>;
  const {minimum,maximum,unit,displayScale} = port.parameter;
  const step = (unit === 'Hz' || unit === 'steps') ? 1 : unit === 'dB' ? 0.5 : 0.01;
  return <div className="patch-fields">
    <NumericSlider label={`${port.label} at 0`} unit={unit} displayFactor={displayScale} min={minimum} max={maximum} step={step}
      value={mapping.from} onChange={from => onChange({...mapping,from})}/>
    <NumericSlider label={`${port.label} at 1`} unit={unit} displayFactor={displayScale} min={minimum} max={maximum} step={step}
      value={mapping.to} onChange={to => onChange({...mapping,to})}/>
  </div>;
}

export function PatchInspector({patch, sampleRate, selection, onModule, onCopyDrone, onMapping, onRemove}: InspectorProps) {
  const module = selection?.kind === 'module' ? patch.modules.find(item => item.id === selection.id) : undefined;
  const cable = selection?.kind === 'cable' ? patch.cables.find(item => item.id === selection.id) : undefined;
  const destination = cable && getPatchPort(patch,cable.destination);
  const followsProgression = module?.kind === 'chord' && patch.cables.some(item =>
    item.destination.moduleId === module.id && item.destination.portId === 'chords');
  return <section className="patch-inspector" aria-label="Patch inspector">
    <div className="patch-inspector-header">
      <h2>{module ? getPatchModuleLabel(module) : destination ? `Cable to ${destination.label}` : 'Patch inspector'}</h2>
      {selection && (module || cable) && <button type="button" onClick={() => onRemove(selection)}>
        {cable ? 'Disconnect cable' : 'Remove module'}</button>}
    </div>
    {followsProgression && <p>Chord Progression sets the root and quality while active. The settings below supply the fallback chord and voicing.</p>}
    {module && <ModuleSettings module={module} sampleRate={sampleRate} onChange={onModule}/>}
    {module?.kind === 'drone' && <>
      <div className="patch-actions patch-drone-copy">
        {DRONE_LAYER_IDS.map(layerId => <button key={layerId} type="button" onClick={() => onCopyDrone(module,layerId)}>
          Copy Drone {layerId}</button>)}
      </div>
      <DroneNodePresets key={module.id} module={module} onLoad={onModule}/>
    </>}
    {cable && <CableSettings patch={patch} cable={cable} onChange={mapping => onMapping(cable.id,mapping)}/>}
    {!module && !cable && <p>Select a module or cable to edit its settings.</p>}
  </section>;
}
