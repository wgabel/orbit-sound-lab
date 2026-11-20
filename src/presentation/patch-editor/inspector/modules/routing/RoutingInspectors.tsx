import type { PatchModule } from '@domain/patch';
import { NumericSlider } from '@presentation/NumericSlider';
import type { PatchModuleInspectorProps } from '../../module-inspector-contracts';

type CrossfaderModule = Extract<PatchModule,{kind:'crossfader'}>;
type MixerModule = Extract<PatchModule,{kind:'mixer'}>;
type LevelModule = Extract<PatchModule,{kind:'gain' | 'output'}>;

export function CrossfaderInspector({module,onChange}: PatchModuleInspectorProps<CrossfaderModule>) {
  return <>
    <div className="patch-fields">
      <NumericSlider label="Blend" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={module.settings.blend} onChange={blend => onChange({...module,settings:{blend}})}/>
    </div>
    <p>0% plays Audio A, 50% blends both, and 100% plays Audio B.</p>
  </>;
}

export function MixerInspector({module,onChange}: PatchModuleInspectorProps<MixerModule>) {
  return <div className="patch-fields">
    <NumericSlider label="Level A" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      value={module.settings.levelA}
      onChange={levelA => onChange({...module,settings:{...module.settings,levelA}})}/>
    <NumericSlider label="Level B" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      value={module.settings.levelB}
      onChange={levelB => onChange({...module,settings:{...module.settings,levelB}})}/>
  </div>;
}

export function LevelInspector({module,onChange}: PatchModuleInspectorProps<LevelModule>) {
  return <div className="patch-fields">
    <NumericSlider label="Base level" unit="%" displayFactor={100} min={0} max={1} step={0.01}
      value={module.settings.level} onChange={level => onChange({...module,settings:{level}})}/>
  </div>;
}
