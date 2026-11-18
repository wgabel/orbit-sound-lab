import { DEFAULT_HARMONY_SETTINGS, validateHarmonySettings } from './harmony';
import type { HarmonySettings } from './harmony';
import type { DroneSettings } from './drone';
import { validateDroneSettings } from './drone';
import type { LowFrequencyOscillatorSettings } from './modulation';
import { validateLowFrequencyOscillatorSettings } from './modulation';
import type { DelaySettings } from './delay';
import { validateDelaySettings } from './delay';

export interface SoundPreset {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly drone: DroneSettings;
  readonly modulation: readonly LowFrequencyOscillatorSettings[];
  readonly delay: DelaySettings;
  readonly harmony?: HarmonySettings;
}
const DATABASE_NAME = 'orbit-sound-lab-presets';
const STORE_NAME = 'presets';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, {keyPath: 'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open preset database.'));
  });
}
async function transact<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result!: T;
    let hasResult = false;
    transaction.oncomplete = () => { database.close(); if (hasResult) resolve(result); else reject(new Error('Preset operation did not complete.')); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Preset operation failed.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Preset operation aborted.')); };
    execute(store, value => { result = value; hasResult = true; }, reject);
  });
}
export function validatePreset(value: unknown): SoundPreset {
  if (!value || typeof value !== 'object') throw new Error('Invalid preset file.');
  const preset = value as Partial<SoundPreset>;
  if (preset.schemaVersion !== 1) throw new Error('Unsupported preset version.');
  if (typeof preset.id !== 'string' || !preset.id || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 120 || typeof preset.createdAt !== 'string') throw new Error('Invalid preset metadata.');
  if (!preset.drone || !Array.isArray(preset.modulation) || !preset.delay) throw new Error('Incomplete preset.');
  validateDroneSettings(preset.drone);
  validateDelaySettings(preset.delay);
  if (preset.harmony !== undefined) validateHarmonySettings(preset.harmony);
  const ids = new Set(preset.drone.oscillators.map(oscillator => oscillator.id));
  if (preset.modulation.length !== ids.size || new Set(preset.modulation.map(item => item.targetOscillatorId)).size !== ids.size) throw new Error('Preset LFO targets do not match oscillators.');
  for (const modulation of preset.modulation) {
    validateLowFrequencyOscillatorSettings(modulation);
    if (!ids.has(modulation.targetOscillatorId)) throw new Error('Unknown preset LFO target.');
  }
  return preset as SoundPreset;
}
export function createPreset(name: string, drone: DroneSettings, modulation: readonly LowFrequencyOscillatorSettings[], delay: DelaySettings, harmony: HarmonySettings = DEFAULT_HARMONY_SETTINGS): SoundPreset {
  return validatePreset({schemaVersion: 1, id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), drone, modulation, delay, harmony});
}
export async function listPresets(): Promise<SoundPreset[]> {
  const values = await transact<unknown[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return values.map(validatePreset).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function savePreset(preset: SoundPreset): Promise<void> {
  const validated = validatePreset(preset);
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(validated);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}
export async function deletePreset(id: string): Promise<void> {
  await transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}
export function exportPreset(preset: SoundPreset): void {
  const blob = new Blob([JSON.stringify(validatePreset(preset), null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'orbit-preset-' + preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importPreset(file: File): Promise<SoundPreset> {
  if (file.size > 1024 * 1024) throw new Error('Preset file exceeds 1 MB.');
  const parsed: unknown = JSON.parse(await file.text());
  const validated = validatePreset(parsed);
  const imported = {...validated, id: crypto.randomUUID(), createdAt: new Date().toISOString()};
  await savePreset(imported);
  return imported;
}
