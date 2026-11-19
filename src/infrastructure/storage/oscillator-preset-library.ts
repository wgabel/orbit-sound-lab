import type { OscillatorSnapshot } from '../../domain/oscillator-clipboard';
import { readOscillatorPreset } from '../../domain/oscillator-preset';
import type { OscillatorPreset } from '../../domain/oscillator-preset';
import { runPresetRequest } from './preset-storage';

const DATABASE_NAME = 'orbit-sound-lab-oscillator-presets';

export async function listOscillatorPresets(): Promise<OscillatorPreset[]> {
  const values = await runPresetRequest<unknown[]>(DATABASE_NAME,'readonly',store => store.getAll());
  return values.map(readOscillatorPreset).sort((first,second) => second.createdAt.localeCompare(first.createdAt));
}

export async function saveOscillatorPreset(name: string, snapshot: OscillatorSnapshot): Promise<void> {
  const preset = readOscillatorPreset({
    kind:'orbit-oscillator',schemaVersion:1,id:crypto.randomUUID(),createdAt:new Date().toISOString(),name,snapshot
  });
  await runPresetRequest(DATABASE_NAME,'readwrite',store => store.put(preset));
}
