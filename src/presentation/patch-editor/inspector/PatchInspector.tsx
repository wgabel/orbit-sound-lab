import { DRONE_LAYER_IDS } from '@domain/drone-layers';
import type { DroneLayerId } from '@domain/drone-layers';
import { getPatchModuleLabel, getPatchPort } from '@domain/patch';
import type { CableMapping, Patch, PatchCable, PatchDrone, PatchModule } from '@domain/patch';
import { NumericSlider } from '@presentation/NumericSlider';
import type { PatchSelection } from '@presentation/patch-editor/canvas/patch-canvas-contracts';
import { DroneNodePresets } from '@presentation/patch-editor/presets/DroneNodePresets';
import { ModuleInspector } from './ModuleInspector';

export interface PatchInspectorProps {
  readonly patch: Patch;
  readonly sampleRate?: number;
  readonly selection: PatchSelection | null;
  onEditDrone(module: PatchDrone): void;
  onCopyDrone(module: PatchDrone, layerId: DroneLayerId): void;
  onModule(module: PatchModule): void;
  onMapping(id: string, mapping: CableMapping): void;
  onRemove(selection: PatchSelection): void;
}

interface CableInspectorProps {
  readonly patch: Patch;
  readonly cable: PatchCable;
  onChange(mapping: CableMapping): void;
}

function CableInspector({patch,cable,onChange}: CableInspectorProps) {
  const port = getPatchPort(patch,cable.destination);
  const mapping = cable.mapping;
  if (port?.signal === 'chords') return <p>Each step changes the generator’s root and chord quality.</p>;
  if (!port?.parameter || !mapping) return <p>This cable carries audio.</p>;
  const {minimum,maximum,unit,displayScale} = port.parameter;
  const step = (unit === 'Hz' || unit === 'steps') ? 1 : unit === 'dB' ? 0.5 : 0.01;
  return <div className="patch-fields">
    <NumericSlider label={`${port.label} at 0`} unit={unit} displayFactor={displayScale}
      min={minimum} max={maximum} step={step} value={mapping.from}
      onChange={from => onChange({...mapping,from})}/>
    <NumericSlider label={`${port.label} at 1`} unit={unit} displayFactor={displayScale}
      min={minimum} max={maximum} step={step} value={mapping.to}
      onChange={to => onChange({...mapping,to})}/>
  </div>;
}

export function PatchInspector({
  patch,
  sampleRate,
  selection,
  onModule,
  onEditDrone,
  onCopyDrone,
  onMapping,
  onRemove
}: PatchInspectorProps) {
  const module = selection?.kind === 'module' ? patch.modules.find(item => item.id === selection.id) : undefined;
  const cable = selection?.kind === 'cable' ? patch.cables.find(item => item.id === selection.id) : undefined;
  const destination = cable && getPatchPort(patch,cable.destination);
  const followsProgression = module?.kind === 'chord' && patch.cables.some(item =>
    item.destination.moduleId === module.id && item.destination.portId === 'chords');

  return <section className="patch-inspector" aria-label="Patch inspector">
    <div className="patch-inspector-header">
      <h2>{module ? getPatchModuleLabel(module) : destination ? `Cable to ${destination.label}` : 'Patch inspector'}</h2>
      {selection && (module || cable) && <button type="button" onClick={() => onRemove(selection)}>
        {cable ? 'Disconnect cable' : 'Remove module'}
      </button>}
    </div>
    {followsProgression && <p>Chord Progression sets the root and quality while active. The settings below supply the fallback chord and voicing.</p>}
    {module && <ModuleInspector module={module} sampleRate={sampleRate} onChange={onModule}/>}
    {module?.kind === 'drone' && <>
      <div className="patch-actions patch-drone-copy">
        <button type="button" onClick={() => onEditDrone(module)}>Edit drone</button>
        {DRONE_LAYER_IDS.map(layerId => <button key={layerId} type="button"
          onClick={() => onCopyDrone(module,layerId)}>Copy Drone {layerId}</button>)}
      </div>
      <DroneNodePresets key={module.id} module={module} onLoad={onModule}/>
    </>}
    {cable && <CableInspector patch={patch} cable={cable}
      onChange={mapping => onMapping(cable.id,mapping)}/>}
    {!module && !cable && <p>Select a module or cable to edit its settings.</p>}
  </section>;
}
