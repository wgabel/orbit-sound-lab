import { useEffect, useRef, useState } from 'react';

interface PresetItem {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

interface PresetLibraryProps<Preset extends PresetItem> {
  readonly label: string;
  readonly nameLimit: number;
  readonly showHeading?: boolean;
  list(): Promise<Preset[]>;
  save(name: string): Promise<unknown>;
  importFile(file: File): Promise<unknown>;
  exportFile(preset: Preset): void;
  remove(id: string): Promise<void>;
  onLoad(preset: Preset): void;
}

export function PresetLibrary<Preset extends PresetItem>({label, nameLimit, showHeading = true, list, save,
  importFile, exportFile, remove, onLoad}: PresetLibraryProps<Preset>) {
  const input = useRef<HTMLInputElement>(null);
  const [presets,setPresets] = useState<Preset[]>([]);
  const [name,setName] = useState('');
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');

  useEffect(() => {
    let active = true;
    void list().then(presets => {
      if (active) setPresets(presets);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : `Cannot read ${label} presets.`);
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => {active = false;};
  }, [list]);

  async function changeLibrary(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setPresets(await list());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Cannot update ${label} presets.`);
    } finally {
      setBusy(false);
    }
  }

  return <section className="patch-preset-library" aria-label={`${label} preset library`} aria-busy={busy}>
    {showHeading && <h3>{label} presets</h3>}
    <form className="preset-actions" onSubmit={event => {
      event.preventDefault();
      if (!name.trim()) return;
      void changeLibrary(async () => {
        await save(name);
        setName('');
      });
    }}>
      <input aria-label={`${label} preset name`} placeholder="Preset name" maxLength={nameLimit}
        value={name} disabled={busy} onChange={event => setName(event.target.value)}/>
      <button type="submit" disabled={busy || !name.trim()}>Save preset</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>Import JSON</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void changeLibrary(() => importFile(file));
      }}/>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="preset-list">
      {!busy && !error && presets.length === 0 && <p>No saved {label} presets yet.</p>}
      {presets.map(preset => <div className="preset-item" key={preset.id}>
        <div><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleString()}</small></div>
        <div className="preset-item-actions">
          <button type="button" disabled={busy} aria-label={`Load ${preset.name}`}
            onClick={() => onLoad(preset)}>Load</button>
          <button type="button" disabled={busy} aria-label={`Export ${preset.name}`}
            onClick={() => exportFile(preset)}>Export</button>
          <button type="button" disabled={busy} aria-label={`Delete ${preset.name}`} onClick={() => {
            if (window.confirm(`Delete ${label} preset "${preset.name}"?`)) {
              void changeLibrary(() => remove(preset.id));
            }
          }}>Delete</button>
        </div>
      </div>)}
    </div>
  </section>;
}
