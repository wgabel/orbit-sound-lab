import { useEffect, useRef, useState } from 'react';
import { AUTOMATION_PRESET_NAME_LIMIT } from '../../domain/automation-preset';
import type { AutomationPreset } from '../../domain/automation-preset';
import type { PatchAutomation } from '../../domain/patch-automation';
import { deleteAutomationPreset, exportAutomationPreset, importAutomationPreset,
  listAutomationPresets, saveAutomationPreset } from '../../infrastructure/storage/automation-preset-library';

export function AutomationPresetLibrary({settings, onLoad}: {
  readonly settings: PatchAutomation;
  onLoad(settings: PatchAutomation): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [presets,setPresets] = useState<AutomationPreset[]>([]);
  const [name,setName] = useState('');
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');

  useEffect(() => {
    let active = true;
    void listAutomationPresets().then(presets => {
      if (active) setPresets(presets);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Cannot read Automation presets.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => {active = false;};
  }, []);

  async function changeLibrary(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setPresets(await listAutomationPresets());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cannot update Automation presets.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="automation-preset-library" aria-label="Automation preset library" aria-busy={busy}>
    <h3>Automation presets</h3>
    <form className="preset-actions" onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) return;
      void changeLibrary(async () => {
        await saveAutomationPreset(name,settings);
        setName('');
      });
    }}>
      <input aria-label="Automation preset name" placeholder="Preset name" maxLength={AUTOMATION_PRESET_NAME_LIMIT}
        value={name} disabled={busy} onChange={event => setName(event.target.value)}/>
      <button type="submit" disabled={busy || !name.trim()}>Save preset</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>Import JSON</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void changeLibrary(() => importAutomationPreset(file));
      }}/>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="preset-list">
      {!busy && !error && presets.length === 0 && <p>No saved Automation presets yet.</p>}
      {presets.map(preset => <div className="preset-item" key={preset.id}>
        <div><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleString()}</small></div>
        <div className="preset-item-actions">
          <button type="button" disabled={busy} aria-label={`Load ${preset.name}`}
            onClick={() => onLoad(structuredClone(preset.automation))}>Load</button>
          <button type="button" disabled={busy} aria-label={`Export ${preset.name}`}
            onClick={() => exportAutomationPreset(preset)}>Export</button>
          <button type="button" disabled={busy} aria-label={`Delete ${preset.name}`} onClick={() => {
            if (window.confirm(`Delete Automation preset "${preset.name}"?`)) {
              void changeLibrary(() => deleteAutomationPreset(preset.id));
            }
          }}>Delete</button>
        </div>
      </div>)}
    </div>
  </section>;
}
