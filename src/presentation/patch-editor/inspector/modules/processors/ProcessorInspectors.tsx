import type { PatchModule } from '@domain/patch';
import { NumericSlider } from '@presentation/NumericSlider';
import { ReverbControls } from '@presentation/ReverbControls';
import { ShelfEqControls } from '@presentation/ShelfEqControls';
import type { PatchModuleInspectorProps } from '../../module-inspector-contracts';

type FilterModule = Extract<PatchModule,{kind:'filter'}>;
type PitchShiftModule = Extract<PatchModule,{kind:'pitchShift'}>;
type ReverbModule = Extract<PatchModule,{kind:'reverb'}>;
type ShelfEqModule = Extract<PatchModule,{kind:'shelfEq'}>;

export function FilterInspector({module,onChange}: PatchModuleInspectorProps<FilterModule>) {
  return <div className="patch-fields">
    <NumericSlider label="Base cutoff" unit="Hz" min={40} max={6000} step={1} value={module.settings.cutoff}
      onChange={cutoff => onChange({...module,settings:{...module.settings,cutoff}})}/>
    <NumericSlider label="Base resonance" unit="Q" min={0.1} max={12} step={0.1} value={module.settings.resonance}
      onChange={resonance => onChange({...module,settings:{...module.settings,resonance}})}/>
  </div>;
}

export function PitchShiftInspector({module,onChange}: PatchModuleInspectorProps<PitchShiftModule>) {
  return <div className="patch-fields">
    <NumericSlider label="Transpose" unit="st" min={-24} max={24} step={1}
      value={module.settings.semitones}
      onChange={semitones => onChange({...module,settings:{...module.settings,semitones}})}/>
    <NumericSlider label="Fine tune" unit="cents" min={-100} max={100} step={1}
      value={module.settings.cents}
      onChange={cents => onChange({...module,settings:{...module.settings,cents}})}/>
    <p>Connect Automation or LFO to Pitch to move the transpose setting. Fine tune is added to the automated value.</p>
  </div>;
}

export function ReverbInspector({module,onChange}: PatchModuleInspectorProps<ReverbModule>) {
  return <ReverbControls settings={module.settings} onChange={settings => onChange({...module,settings})}/>;
}

export function ShelfEqInspector({module,sampleRate,onChange}: PatchModuleInspectorProps<ShelfEqModule>) {
  return <ShelfEqControls settings={module.settings} sampleRate={sampleRate}
    onChange={settings => onChange({...module,settings})}/>;
}

export function OscilloscopeInspector() {
  return <p>Connect an audio signal to inspect it. Audio out passes it through.</p>;
}
