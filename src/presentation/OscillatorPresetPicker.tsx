import { useId, useRef, useState } from 'react';
import { builtInOscillatorPresetGroups, builtInOscillatorPresets, createBuiltInOscillatorSnapshot } from '../domain/built-in-oscillator-presets';
import { retargetOscillatorSnapshot } from '../domain/oscillator-clipboard';
import type { OscillatorSnapshot } from '../domain/oscillator-clipboard';
import { OSCILLATOR_PRESET_NAME_LIMIT } from '../domain/oscillator-preset';
import type { OscillatorPreset } from '../domain/oscillator-preset';

interface OscillatorPresetPickerProps {
  readonly oscillatorNumber: number;
  readonly snapshot: OscillatorSnapshot;
  readonly customPresets: readonly OscillatorPreset[];
  readonly busy: boolean;
  onLoad(snapshot: OscillatorSnapshot, name: string): void;
  onSave(name: string, snapshot: OscillatorSnapshot): Promise<boolean>;
}

const CUSTOM_PRESET_PREFIX = 'custom:';

export function OscillatorPresetPicker({oscillatorNumber,snapshot,customPresets,busy,onLoad,onSave}: OscillatorPresetPickerProps) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name,setName] = useState('');
  const [error,setError] = useState('');

  function load(value: string) {
    if (value.startsWith(CUSTOM_PRESET_PREFIX)) {
      const preset = customPresets.find(item => item.id === value.slice(CUSTOM_PRESET_PREFIX.length));
      if (preset) onLoad(retargetOscillatorSnapshot(preset.snapshot,snapshot.oscillator),preset.name);
      return;
    }
    const preset = builtInOscillatorPresets.find(item => item.id === value);
    if (preset) onLoad(createBuiltInOscillatorSnapshot(preset.id,snapshot.oscillator),preset.name);
  }

  async function save() {
    setError('');
    try {
      if (await onSave(name.trim(),snapshot)) dialog.current?.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cannot save oscillator preset.');
    }
  }

  return <>
    <select className="oscillator-preset-select" aria-label={`Preset for oscillator ${oscillatorNumber}`}
      value="" onChange={event => load(event.target.value)}>
      <option value="" disabled>PRESETS</option>
      {builtInOscillatorPresetGroups.map(group => <optgroup key={group.label} label={group.label}>
        {group.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
      </optgroup>)}
      <optgroup label="Custom">
        {customPresets.length ? customPresets.map(preset =>
          <option key={preset.id} value={CUSTOM_PRESET_PREFIX + preset.id}>{preset.name}</option>) :
          <option disabled value="custom:empty">{busy ? 'Loading presets…' : 'No saved presets yet'}</option>}
      </optgroup>
    </select>
    <button type="button" className="randomize-button" disabled={busy} aria-haspopup="dialog" aria-controls={dialogId}
      onClick={() => {setName(''); setError(''); dialog.current?.showModal();}}>SAVE AS PRESET</button>
    <dialog id={dialogId} ref={dialog} className="oscillator-preset-dialog" aria-labelledby={`${dialogId}-title`}>
      <form onSubmit={event => {event.preventDefault(); void save();}}>
        <h3 id={`${dialogId}-title`}>Save Oscillator {oscillatorNumber} preset</h3>
        <label>Preset name<input autoFocus required maxLength={OSCILLATOR_PRESET_NAME_LIMIT} value={name}
          onChange={event => setName(event.target.value)} disabled={busy}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="oscillator-preset-dialog-actions">
          <button type="button" className="randomize-button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className="randomize-button" disabled={busy || !name.trim()}>Save preset</button>
        </div>
      </form>
    </dialog>
  </>;
}
