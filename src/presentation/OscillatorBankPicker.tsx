import { oscillatorBankGroups } from '@domain/built-in-oscillator-banks';

export function OscillatorBankPicker({onLoad}: {onLoad(presetId: string): void}) {
  return <label className="oscillator-bank-picker">5-oscillator preset
    <select value="" aria-label="Load five-oscillator preset" onChange={event => onLoad(event.target.value)}>
      <option value="" disabled>Choose a preset</option>
      {oscillatorBankGroups.map(group => <optgroup key={group.label} label={group.label}>
        {group.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
      </optgroup>)}
    </select>
  </label>;
}
