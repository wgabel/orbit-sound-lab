import { OSCILLATOR_WAVEFORMS, supportsOscillatorShape } from '../../domain/drone';
import type { OscillatorWaveform } from '../../domain/drone';
import { getPatchPort, MODULE_LABELS } from '../../domain/patch';
import type { CableMapping, Patch, PatchCable, PatchModule } from '../../domain/patch';
import type { PatchAutomation } from '../../domain/patch-automation';
import type { PatchSelection } from './PatchCanvas';
import { NumericSlider } from '../NumericSlider';

interface InspectorProps {
  readonly patch: Patch;
  readonly selection: PatchSelection | null;
  onModule(module: PatchModule): void;
  onMapping(id: string, mapping: CableMapping): void;
  onRemove(selection: PatchSelection): void;
}

function AutomationSettings({settings, onChange}: {settings: PatchAutomation; onChange(settings: PatchAutomation): void}) {
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
        <option value="sine">Sine LFO</option><option value="square">Square LFO</option>
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
    {(settings.shape === 'steps' || settings.shape === 'curve') && <div className="patch-fields patch-points">
      {settings.points.slice(0, settings.shape === 'steps' ? -1 : undefined).map((point,index) =>
        <NumericSlider key={point.position} label={`${settings.shape === 'steps' ? 'Step' : 'Point'} ${index+1} · ${+(point.position * settings.duration).toFixed(2)} s`}
          unit="%" displayFactor={100} min={0} max={1} step={0.01} value={point.value} onChange={value => updatePoint(index,value)}/>)}
    </div>}
  </>;
}

function ModuleSettings({module, onChange}: {module: PatchModule; onChange(module: PatchModule): void}) {
  switch (module.kind) {
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
    case 'filter': return <div className="patch-fields">
      <NumericSlider label="Base cutoff" unit="Hz" min={40} max={6000} step={1} value={module.settings.cutoff}
        onChange={cutoff => onChange({...module,settings:{...module.settings,cutoff}})}/>
      <NumericSlider label="Base resonance" unit="Q" min={0.1} max={12} step={0.1} value={module.settings.resonance}
        onChange={resonance => onChange({...module,settings:{...module.settings,resonance}})}/>
    </div>;
    case 'mixer': return <div className="patch-fields">
      <NumericSlider label="Level A" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={module.settings.levelA} onChange={levelA => onChange({...module,settings:{...module.settings,levelA}})}/>
      <NumericSlider label="Level B" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={module.settings.levelB} onChange={levelB => onChange({...module,settings:{...module.settings,levelB}})}/>
    </div>;
    case 'gain':
    case 'output': return <div className="patch-fields">
      <NumericSlider label="Base level" unit="%" displayFactor={100} min={0} max={1} step={0.01} value={module.settings.level}
        onChange={level => onChange({...module,settings:{level}})}/>
    </div>;
    case 'automation': return <AutomationSettings settings={module.settings} onChange={settings => onChange({...module,settings})}/>;
    case 'drone': return <p>{module.settings.voice.oscillators.filter(oscillator => oscillator.enabled).length} active oscillator voices</p>;
  }
}

function CableSettings({patch, cable, onChange}: {patch: Patch; cable: PatchCable; onChange(mapping: CableMapping): void}) {
  const port = getPatchPort(patch,cable.destination);
  const mapping = cable.mapping;
  if (!port?.parameter || !mapping) return <p>This cable carries audio.</p>;
  const {minimum,maximum,unit,displayScale} = port.parameter;
  const step = unit === 'Hz' ? 1 : 0.01;
  return <div className="patch-fields">
    <NumericSlider label={`${port.label} at 0`} unit={unit} displayFactor={displayScale} min={minimum} max={maximum} step={step}
      value={mapping.from} onChange={from => onChange({...mapping,from})}/>
    <NumericSlider label={`${port.label} at 1`} unit={unit} displayFactor={displayScale} min={minimum} max={maximum} step={step}
      value={mapping.to} onChange={to => onChange({...mapping,to})}/>
  </div>;
}

export function PatchInspector({patch, selection, onModule, onMapping, onRemove}: InspectorProps) {
  const module = selection?.kind === 'module' ? patch.modules.find(item => item.id === selection.id) : undefined;
  const cable = selection?.kind === 'cable' ? patch.cables.find(item => item.id === selection.id) : undefined;
  const destination = cable && getPatchPort(patch,cable.destination);
  return <section className="patch-inspector" aria-label="Patch inspector">
    <div className="patch-inspector-header">
      <h2>{module ? MODULE_LABELS[module.kind] : destination ? `Cable to ${destination.label}` : 'Patch inspector'}</h2>
      {selection && (module || cable) && <button type="button" onClick={() => onRemove(selection)}>
        {cable ? 'Disconnect cable' : 'Remove module'}</button>}
    </div>
    {module && <ModuleSettings module={module} onChange={onModule}/>}
    {cable && <CableSettings patch={patch} cable={cable} onChange={mapping => onMapping(cable.id,mapping)}/>}
    {!module && !cable && <p>Select a module or cable to edit its settings.</p>}
  </section>;
}
