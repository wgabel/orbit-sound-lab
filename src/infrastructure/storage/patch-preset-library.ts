import { readPatchPreset } from '../../domain/patch-preset';
import type { PatchPreset, PatchSnapshot } from '../../domain/patch-preset';
import { downloadPresetJson, readPresetJson, runPresetRequest } from './preset-storage';

const DATABASE_NAME = 'orbit-sound-lab-patch-presets';

export async function listPatchPresets(): Promise<PatchPreset[]> {
  const values = await runPresetRequest<unknown[]>(DATABASE_NAME,'readonly',store => store.getAll());
  return values.map(readPatchPreset).sort((first,second) => second.createdAt.localeCompare(first.createdAt));
}

export async function savePatchPreset(name: string, snapshot: PatchSnapshot): Promise<void> {
  const preset = readPatchPreset({...snapshot,kind:'orbit-patch',schemaVersion:1,name,
    id:crypto.randomUUID(),createdAt:new Date().toISOString()});
  await runPresetRequest(DATABASE_NAME,'readwrite',store => store.put(preset));
}

export async function deletePatchPreset(id: string): Promise<void> {
  await runPresetRequest(DATABASE_NAME,'readwrite',store => store.delete(id));
}

export function exportPatchPreset(preset: PatchPreset): void {
  downloadPresetJson('orbit-patch-',preset.name,readPatchPreset(preset));
}

export async function importPatchPreset(file: File): Promise<void> {
  const preset = readPatchPreset(await readPresetJson(file));
  await savePatchPreset(preset.name,preset);
}
