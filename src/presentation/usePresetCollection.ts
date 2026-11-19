import { useEffect, useRef, useState } from 'react';

export function usePresetCollection<Preset>(list: () => Promise<Preset[]>) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const updating = useRef(false);

  useEffect(() => {
    let active = true;
    void list().then(presets => {
      if (active) setPresets(presets);
    }).catch(reason => {
      if (active) setLoadError(reason instanceof Error ? reason.message : 'Cannot read presets.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [list]);

  async function update(operation: () => Promise<unknown>): Promise<boolean> {
    if (busy || updating.current) return false;
    updating.current = true;
    setBusy(true);
    try {
      await operation();
      setPresets(await list());
      setLoadError('');
      return true;
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  return {presets,busy,loadError,update};
}
