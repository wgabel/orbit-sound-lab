import { readAutomationPreset } from '../../domain/automation-preset';
import type { AutomationPreset } from '../../domain/automation-preset';
import type { PatchAutomation } from '../../domain/patch-automation';
import { downloadPresetJson, runPresetRequest } from './preset-storage';

const DATABASE_NAME = 'orbit-sound-lab-automation-presets';

export async function listAutomationPresets(): Promise<AutomationPreset[]> {
  const values = await runPresetRequest<unknown[]>(DATABASE_NAME,'readonly',store => store.getAll());
  return values.map(readAutomationPreset).sort((first,second) => second.createdAt.localeCompare(first.createdAt));
}

export async function saveAutomationPreset(name: string, automation: PatchAutomation): Promise<AutomationPreset> {
  const preset = readAutomationPreset({
    kind:'orbit-automation', schemaVersion:1, name, automation,
    id:crypto.randomUUID(), createdAt:new Date().toISOString()
  });
  await runPresetRequest(DATABASE_NAME,'readwrite',store => store.put(preset));
  return preset;
}

export async function deleteAutomationPreset(id: string): Promise<void> {
  await runPresetRequest(DATABASE_NAME,'readwrite',store => store.delete(id));
}

export function exportAutomationPreset(preset: AutomationPreset): void {
  downloadPresetJson('orbit-automation-',preset.name,readAutomationPreset(preset));
}

export async function importAutomationPreset(file: File): Promise<AutomationPreset> {
  if (file.size > 1024 * 1024) throw new Error('Preset file exceeds 1 MB.');
  const content = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  const preset = readAutomationPreset(parsed);
  return saveAutomationPreset(preset.name,preset.automation);
}
