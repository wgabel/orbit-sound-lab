import { MAXIMUM_SIMPLEX_NOISE_RATE, MAXIMUM_SIMPLEX_NOISE_SEED,
  MINIMUM_SIMPLEX_NOISE_RATE } from '@domain/simplex-noise';
import type { PatchModule } from '@domain/patch';
import type { PatchAutomation } from '@domain/patch/automation';
import { NumericSlider } from '@presentation/NumericSlider';
import { AutomationPresetLibrary } from '@presentation/patch-editor/presets/AutomationPresetLibrary';
import type { PatchModuleInspectorProps } from '../../module-inspector-contracts';
import { AutomationSettings } from './AutomationSettings';
import { ChordProgressionSettings } from './ChordProgressionSettings';
import { PatchLfoSettings } from './PatchLfoSettings';

type AutomationModule = Extract<PatchModule,{kind:'automation'}>;
type ChordProgressionModule = Extract<PatchModule,{kind:'chordProgression'}>;
type LfoModule = Extract<PatchModule,{kind:'lfo'}>;
type SimplexNoiseModule = Extract<PatchModule,{kind:'simplexNoise'}>;

export function AutomationInspector({module,onChange}: PatchModuleInspectorProps<AutomationModule>) {
  const update = (settings: PatchAutomation) => onChange({...module,settings});
  return <>
    <AutomationSettings settings={module.settings} onChange={update}/>
    <AutomationPresetLibrary key={module.id} settings={module.settings} onLoad={update}/>
  </>;
}

export function ChordProgressionInspector({module,onChange}: PatchModuleInspectorProps<ChordProgressionModule>) {
  return <ChordProgressionSettings settings={module.settings}
    onChange={settings => onChange({...module,settings})}/>;
}

export function LfoInspector({module,onChange}: PatchModuleInspectorProps<LfoModule>) {
  return <PatchLfoSettings settings={module.settings} onChange={settings => onChange({...module,settings})}/>;
}

export function SimplexNoiseInspector({module,onChange}: PatchModuleInspectorProps<SimplexNoiseModule>) {
  return <div className="patch-fields">
    <NumericSlider label="Rate" unit="cells/s" min={MINIMUM_SIMPLEX_NOISE_RATE} max={MAXIMUM_SIMPLEX_NOISE_RATE}
      step={0.01} scale="logarithmic" value={module.settings.rate}
      onChange={rate => onChange({...module,settings:{...module.settings,rate}})}/>
    <NumericSlider label="Seed" min={0} max={MAXIMUM_SIMPLEX_NOISE_SEED} step={1} value={module.settings.seed}
      onChange={seed => onChange({...module,settings:{...module.settings,seed:Math.round(seed)}})}/>
  </div>;
}
