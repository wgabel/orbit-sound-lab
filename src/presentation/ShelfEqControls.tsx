import { MAX_SHELF_FREQUENCY_HZ, MAX_SHELF_GAIN_DECIBELS, MIN_SHELF_FREQUENCY_HZ } from '../domain/drone';
import type { ShelfEqSettings } from '../domain/drone';
import { DroneShelfResponse } from './DroneShelfResponse';
import { NumericSlider } from './NumericSlider';

const shelfControls = [
  {key:'lowShelf',label:'Low shelf'},
  {key:'highShelf',label:'High shelf'}
] as const;

export function ShelfEqControls({settings, sampleRate, onChange}: {
  readonly settings: ShelfEqSettings;
  readonly sampleRate?: number;
  onChange(settings: ShelfEqSettings): void;
}) {
  return <>
    <DroneShelfResponse settings={settings} sampleRate={sampleRate}/>
    <div className="drone-mix-controls drone-shelf-controls">
      {shelfControls.map(({key,label}) => {
        const shelf = settings[key];
        return <div key={key}>
          <h3 data-shelf={key}>{label}</h3>
          <NumericSlider label={`${label} frequency`} unit="Hz" min={MIN_SHELF_FREQUENCY_HZ} max={MAX_SHELF_FREQUENCY_HZ}
            step={1} scale="logarithmic" value={shelf.frequencyHz}
            onChange={frequencyHz => onChange({...settings,[key]:{...shelf,frequencyHz}})}/>
          <NumericSlider label={`${label} gain`} unit="dB" min={-MAX_SHELF_GAIN_DECIBELS} max={MAX_SHELF_GAIN_DECIBELS}
            step={0.5} value={shelf.gainDecibels}
            onChange={gainDecibels => onChange({...settings,[key]:{...shelf,gainDecibels}})}/>
        </div>;
      })}
    </div>
  </>;
}
