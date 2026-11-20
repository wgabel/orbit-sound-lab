import { useId, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_DRONE_EFFECT_ORDER, DEFAULT_DRONE_EFFECTS, DRONE_EFFECT_RANGES, moveDroneEffect } from '@domain/drone-effects';
import type { ChorusSettings, DroneEffectId, DroneEffectsSettings, FlangerSettings } from '@domain/drone-effects';
import type { DroneMixSettings } from '@domain/drone';
import type { DroneLayerId } from '@domain/drone-layers';
import { resolveReverb } from '@domain/reverb';
import { DelayControls } from './DelayControls';
import { NumericSlider } from './NumericSlider';
import { ReverbControls } from './ReverbControls';
import { ShelfEqControls } from './ShelfEqControls';

const effectNames: Record<DroneEffectId,string> = {
  eq:'EQ', overdrive:'Overdrive', compressor:'Compressor', chorus:'Chorus',
  flanger:'Flanger', delay:'Delay', reverb:'Reverb'
};

interface DroneEffectsProps {
  readonly layerId: DroneLayerId;
  readonly settings: DroneMixSettings;
  readonly sampleRate?: number;
  onChange(settings: DroneMixSettings): void;
}

export function DroneEffects({layerId,settings,sampleRate,onChange}: DroneEffectsProps) {
  const [expanded,setExpanded] = useState<DroneEffectId | null>(null);
  const focusedMoveButton = useRef<HTMLButtonElement | null>(null);
  const settingsId = useId();
  const effects = settings.effects ?? DEFAULT_DRONE_EFFECTS;
  const order = effects.order ?? DEFAULT_DRONE_EFFECT_ORDER;
  const {overdrive,compressor,chorus,flanger,delay} = effects;
  const {reverb} = settings;
  const ranges = DRONE_EFFECT_RANGES;

  function updateEffects(next: Partial<DroneEffectsSettings>) {
    onChange({...settings,effects:{...effects,...next}});
  }

  const enabled = {...effects, eq:{enabled:effects.eqEnabled}, reverb};
  useLayoutEffect(() => {
    focusedMoveButton.current?.focus({preventScroll:true});
    focusedMoveButton.current = null;
  },[order]);

  function move(index: number, direction: -1 | 1, button: HTMLButtonElement) {
    const nextOrder = moveDroneEffect(order,index,direction);
    if (nextOrder === order) return;
    if (document.activeElement === button) focusedMoveButton.current = button;
    updateEffects({order:nextOrder});
  }

  function toggle(id: DroneEffectId, enabled: boolean) {
    if (id === 'eq') updateEffects({eqEnabled:enabled});
    else if (id === 'reverb') onChange({...settings,reverb:{...reverb,enabled}});
    else updateEffects({[id]:{...effects[id],enabled}});
  }

  function renderControls(id: DroneEffectId) {
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
    <ol className="drone-effect-chain" aria-label="Effect signal order" role="list">
      {order.map((id,index) => {
        const name = effectNames[id];
        const isExpanded = id === expanded;
        return <li key={id} className="drone-effect" data-enabled={enabled[id].enabled}>
          <div className="drone-effect-row">
            <button type="button" className="drone-effect-settings" aria-expanded={isExpanded}
              aria-controls={isExpanded ? settingsId : undefined} onClick={() => setExpanded(current => current === id ? null : id)}>
              {name}<span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
            </button>
            <label className="drone-effect-switch">
              <input type="checkbox" aria-label={`Enable ${name}`} checked={enabled[id].enabled}
                onChange={event => toggle(id,event.target.checked)}/>
              <span aria-hidden="true">{enabled[id].enabled ? 'On' : 'Off'}</span>
            </label>
            <div className="drone-effect-order">
              <button type="button" aria-label={`Move ${name} up`} aria-disabled={index === 0}
                onClick={event => move(index,-1,event.currentTarget)}>↑</button>
              <button type="button" aria-label={`Move ${name} down`} aria-disabled={index === order.length - 1}
                onClick={event => move(index,1,event.currentTarget)}>↓</button>
            </div>
          </div>
          {isExpanded && <div className="drone-effect-detail" id={settingsId} role="region" aria-label={`${name} settings`}>
            {renderControls(id)}
          </div>}
        </li>;
      })}
    </ol>
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
