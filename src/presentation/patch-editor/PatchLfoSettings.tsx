import { LFO_MAXIMUM_RATE_HZ, LFO_MINIMUM_RATE_HZ, LOW_FREQUENCY_OSCILLATOR_WAVEFORMS } from '../../domain/modulation';
import type { LowFrequencyOscillatorWaveform } from '../../domain/modulation';
import type { PatchLfo } from '../../domain/patch-lfo';
import { LfoCycleInput } from '../LfoCycleInput';
import { NumericSlider } from '../NumericSlider';

export function PatchLfoSettings({settings,onChange}: {settings: PatchLfo; onChange(settings: PatchLfo): void}) {
  function updateRate(rateHz: number) {
    onChange({...settings,rateHz});
  }

  return <div className="patch-fields">
    <label>Waveform<select value={settings.waveform}
      onChange={event => onChange({...settings,waveform:event.target.value as LowFrequencyOscillatorWaveform})}>
      {LOW_FREQUENCY_OSCILLATOR_WAVEFORMS.map(waveform => <option key={waveform} value={waveform}>
        {waveform === 'smoothRandom' ? 'Smooth Random' : waveform[0].toUpperCase() + waveform.slice(1)}
      </option>)}
    </select></label>
    <div>
      <NumericSlider label="Rate" unit="Hz" min={LFO_MINIMUM_RATE_HZ} max={LFO_MAXIMUM_RATE_HZ}
        step={0.01} scale="logarithmic" value={settings.rateHz} onChange={updateRate}/>
      <LfoCycleInput rateHz={settings.rateHz} disabled={false} onRateChange={updateRate}/>
    </div>
    <label><input type="checkbox" checked={settings.sync}
      onChange={event => onChange({...settings,sync:event.target.checked})}/> Synchronize with patch</label>
    <NumericSlider label="Phase" unit="°" min={0} max={360} step={1} disabled={!settings.sync}
      value={settings.phaseDegrees} onChange={phaseDegrees => onChange({...settings,phaseDegrees})}/>
  </div>;
}
