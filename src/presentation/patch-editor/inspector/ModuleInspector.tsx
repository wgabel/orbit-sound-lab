import type { PatchModule } from '@domain/patch';
import { AutomationInspector, ChordProgressionInspector, LfoInspector,
  SimplexNoiseInspector } from './modules/control/ControlInspectors';
import { FilterInspector, OscilloscopeInspector, PitchShiftInspector,
  ReverbInspector, ShelfEqInspector } from './modules/processors/ProcessorInspectors';
import { CrossfaderInspector, LevelInspector, MixerInspector } from './modules/routing/RoutingInspectors';
import { ChordInspector, DroneInspector, WaveInspector } from './modules/sources/SourceInspectors';

export interface ModuleInspectorProps {
  readonly module: PatchModule;
  readonly sampleRate?: number;
  onChange(module: PatchModule): void;
}

/** Routes a discriminated patch module to its focused settings component. */
export function ModuleInspector({module,sampleRate,onChange}: ModuleInspectorProps) {
  switch (module.kind) {
    case 'automation': return <AutomationInspector module={module} onChange={onChange}/>;
    case 'chord': return <ChordInspector module={module} onChange={onChange}/>;
    case 'chordProgression': return <ChordProgressionInspector module={module} onChange={onChange}/>;
    case 'drone': return <DroneInspector module={module} onChange={onChange}/>;
    case 'filter': return <FilterInspector module={module} onChange={onChange}/>;
    case 'gain':
    case 'output': return <LevelInspector module={module} onChange={onChange}/>;
    case 'lfo': return <LfoInspector module={module} onChange={onChange}/>;
    case 'mixer': return <MixerInspector module={module} onChange={onChange}/>;
    case 'crossfader': return <CrossfaderInspector module={module} onChange={onChange}/>;
    case 'oscilloscope': return <OscilloscopeInspector/>;
    case 'pitchShift': return <PitchShiftInspector module={module} onChange={onChange}/>;
    case 'reverb': return <ReverbInspector module={module} onChange={onChange}/>;
    case 'shelfEq': return <ShelfEqInspector module={module} sampleRate={sampleRate} onChange={onChange}/>;
    case 'simplexNoise': return <SimplexNoiseInspector module={module} onChange={onChange}/>;
    case 'wave': return <WaveInspector module={module} onChange={onChange}/>;
  }
}
