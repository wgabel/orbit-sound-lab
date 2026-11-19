import { useId, useState } from 'react';
import { DEFAULT_DRONE_EFFECTS, DRONE_EFFECT_RANGES } from '../domain/drone-effects';
import type { ChorusSettings, DroneEffectsSettings, FlangerSettings } from '../domain/drone-effects';
import type { DroneMixSettings } from '../domain/drone';
import type { DroneLayerId } from '../domain/drone-layers';
import { resolveReverb } from '../domain/reverb';
import { DelayControls } from './DelayControls';
import { NumericSlider } from './NumericSlider';
import { ReverbControls } from './ReverbControls';
import { ShelfEqControls } from './ShelfEqControls';

const effectsInSignalOrder = [
  {id:'eq', name:'EQ'},
  {id:'overdrive', name:'Overdrive'},
  {id:'compressor', name:'Compressor'},
  {id:'chorus', name:'Chorus'},
  {id:'flanger', name:'Flanger'},
  {id:'delay', name:'Delay'},
  {id:'reverb', name:'Reverb'}
] as const;
type EffectId = typeof effectsInSignalOrder[number]['id'];

interface DroneEffectsProps {
  readonly layerId: DroneLayerId;
  readonly settings: DroneMixSettings;
  readonly sampleRate?: number;
  onChange(settings: DroneMixSettings): void;
}

export function DroneEffects({layerId,settings,sampleRate,onChange}: DroneEffectsProps) {
  const [expanded,setExpanded] = useState<EffectId | null>(null);
  const settingsId = useId();
  const effects = settings.effects ?? DEFAULT_DRONE_EFFECTS;
  const {overdrive,compressor,chorus,flanger,delay} = effects;
  const {reverb} = settings;
  const ranges = DRONE_EFFECT_RANGES;

  function updateEffects(next: Partial<DroneEffectsSettings>) {
    onChange({...settings,effects:{...effects,...next}});
  }

  const enabled = {...effects, eq:{enabled:effects.eqEnabled}, reverb};
  function toggle(id: EffectId, enabled: boolean) {
    if (id === 'eq') updateEffects({eqEnabled:enabled});
    else if (id === 'reverb') onChange({...settings,reverb:{...reverb,enabled}});
    else updateEffects({[id]:{...effects[id],enabled}});
  }

  function renderControls(id: EffectId) {
    switch (id) {
      case 'eq': return <ShelfEqControls settings={settings} sampleRate={sampleRate}
        onChange={shelves => onChange({...settings,...shelves})}/>;
      case 'overdrive': return <div className="effect-control-grid">
        <NumericSlider label="Drive" unit="dB" {...ranges.drive} step={0.5} value={overdrive.driveDecibels}
          onChange={driveDecibels => updateEffects({overdrive:{...overdrive,driveDecibels}})}/>
        <NumericSlider label="Tone" unit="Hz" {...ranges.tone} step={10} scale="logarithmic" value={overdrive.toneHz}
          onChange={toneHz => updateEffects({overdrive:{...overdrive,toneHz}})}/>
        <NumericSlider label="Wet mix" unit="%" displayFactor={100} {...ranges.mix} step={0.01} value={overdrive.mix}
          onChange={mix => updateEffects({overdrive:{...overdrive,mix}})}/>
      </div>;
      case 'compressor': return <div className="effect-control-grid">
        <NumericSlider label="Threshold" unit="dB" {...ranges.threshold} step={1} value={compressor.thresholdDecibels}
          onChange={thresholdDecibels => updateEffects({compressor:{...compressor,thresholdDecibels}})}/>
        <NumericSlider label="Ratio" unit=":1" {...ranges.ratio} step={0.1} value={compressor.ratio}
          onChange={ratio => updateEffects({compressor:{...compressor,ratio}})}/>
        <NumericSlider label="Attack" unit="ms" {...ranges.attack} step={1} value={compressor.attackMilliseconds}
          onChange={attackMilliseconds => updateEffects({compressor:{...compressor,attackMilliseconds}})}/>
        <NumericSlider label="Release" unit="ms" {...ranges.release} step={1} value={compressor.releaseMilliseconds}
          onChange={releaseMilliseconds => updateEffects({compressor:{...compressor,releaseMilliseconds}})}/>
      </div>;
      case 'chorus': return <ModulatedDelayControls settings={chorus}
        onChange={next => updateEffects({chorus:next})}/>;
      case 'flanger': return <ModulatedDelayControls settings={flanger}
        onChange={next => updateEffects({flanger:next})}/>;
      case 'delay': return <DelayControls settings={delay} onChange={next => updateEffects({delay:next})}/>;
      case 'reverb': return <ReverbControls settings={resolveReverb(reverb)}
        onChange={next => onChange({...settings,reverb:{...next,enabled:reverb.enabled}})}
        onPreset={next => onChange({...settings,reverb:{...next,enabled:true}})}/>;
    }
  }

  return <section className="drone-effects" data-layer={layerId} aria-labelledby="drone-effects-title">
    <h2 id="drone-effects-title">Effects</h2>
    <div className="drone-effect-chain">
      {effectsInSignalOrder.map(({id,name}) => <div key={id} className="drone-effect" data-enabled={enabled[id].enabled}>
        <button type="button" className="drone-effect-settings" aria-expanded={id === expanded}
          aria-controls={id === expanded ? settingsId : undefined} onClick={() => setExpanded(current => current === id ? null : id)}>
          {name}<span aria-hidden="true">{id === expanded ? '−' : '+'}</span>
        </button>
        <label className="drone-effect-switch">
          <input type="checkbox" aria-label={`Enable ${name}`} checked={enabled[id].enabled}
            onChange={event => toggle(id,event.target.checked)}/>
          <span aria-hidden="true">{enabled[id].enabled ? 'On' : 'Off'}</span>
        </label>
      </div>)}
    </div>
    {expanded && <div className="drone-effect-detail" id={settingsId} role="region"
      aria-label={`${effectsInSignalOrder.find(effect => effect.id === expanded)?.name} settings`}>
      {renderControls(expanded)}
    </div>}
  </section>;
}

function ModulatedDelayControls<Settings extends ChorusSettings | FlangerSettings>({settings,onChange}: {
  readonly settings: Settings;
  onChange(settings: Settings): void;
}) {
  const ranges = DRONE_EFFECT_RANGES;
  const flanger = 'feedback' in settings;
  return <div className="effect-control-grid">
    <NumericSlider label="Rate" unit="Hz" {...(flanger ? ranges.flangerRate : ranges.chorusRate)}
      step={0.01} value={settings.rateHz} onChange={rateHz => onChange({...settings,rateHz})}/>
    <NumericSlider label="Depth" unit="ms" {...(flanger ? ranges.flangerDepth : ranges.chorusDepth)}
      step={0.1} value={settings.depthMilliseconds} onChange={depthMilliseconds => onChange({...settings,depthMilliseconds})}/>
    {flanger && <NumericSlider label="Feedback" unit="%" displayFactor={100} {...ranges.flangerFeedback}
      step={0.01} value={settings.feedback} onChange={feedback => onChange({...settings,feedback})}/>}
    <NumericSlider label="Wet mix" unit="%" displayFactor={100} {...ranges.mix} step={0.01}
      value={settings.mix} onChange={mix => onChange({...settings,mix})}/>
  </div>;
}
