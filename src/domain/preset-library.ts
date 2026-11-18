import { DEFAULT_DRONE_ENVELOPE } from './drone-envelope';
import { createDefaultLayerMix, validateMasterGain } from './drone-layers';
import type { DroneLayer, DroneLayerId, LayerMix } from './drone-layers';
import { DEFAULT_HARMONY_SETTINGS, validateHarmonySettings } from './harmony';
import type { HarmonySettings } from './harmony';
import type { DroneSettings } from './drone';
import { createDefaultDroneMix, validateDroneSettings } from './drone';
import type { LowFrequencyOscillatorSettings } from './modulation';
import { createDefaultLowFrequencyOscillators, LFO_DESTINATIONS, validateLowFrequencyOscillatorSettings } from './modulation';
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
  readonly layerMix: LayerMix;
  readonly sourceLayer: DroneLayerId;
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
export function normalizePresetModulations(modulations: readonly LowFrequencyOscillatorSettings[], oscillatorIds: readonly string[]): readonly LowFrequencyOscillatorSettings[] {
  return createDefaultLowFrequencyOscillators(oscillatorIds).map(defaults =>
    modulations.find(item => item.targetOscillatorId === defaults.targetOscillatorId &&
      item.destination === defaults.destination) ?? defaults);
}
function validateLayerSound(settings: DroneSettings, modulationSettings: readonly LowFrequencyOscillatorSettings[]) {
  if (!settings || !Array.isArray(settings.oscillators) || !Array.isArray(modulationSettings)) throw new Error('Incomplete preset layer.');
  const defaults = createDefaultDroneMix();
  const mix = settings.mix === undefined ? defaults : settings.mix;
  const drone: DroneSettings = {
    ...settings,
    envelope: settings.envelope === undefined ? DEFAULT_DRONE_ENVELOPE : settings.envelope,
    mix: mix && mix.reverb === undefined ? {...mix, reverb: defaults.reverb} : mix,
    oscillators: settings.oscillators.map(oscillator =>
      oscillator.pan === undefined ? {...oscillator, pan: 0} : oscillator)
  };
  validateDroneSettings(drone);
  const ids = drone.oscillators.map(oscillator => oscillator.id);
  if (![1, 3, LFO_DESTINATIONS.length].some(count => modulationSettings.length === ids.length * count)) {
    throw new Error('Preset LFO targets do not match oscillators.');
  }
  const keys = modulationSettings.map(item => item.targetOscillatorId + ':' + item.destination);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate preset LFO destinations.');
  for (const modulation of modulationSettings) {
    validateLowFrequencyOscillatorSettings(modulation);
    if (!ids.includes(modulation.targetOscillatorId)) throw new Error('Unknown preset LFO target.');
  }
  return {drone, modulation: normalizePresetModulations(modulationSettings, ids)};
}

export function validatePreset(value: unknown): SoundPreset {
  if (!value || typeof value !== 'object') throw new Error('Invalid preset file.');
  const preset = value as Partial<SoundPreset>;
  const {schemaVersion, id, name, createdAt, delay, harmony} = preset;
  if (schemaVersion !== 1) throw new Error('Unsupported preset version.');
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim() || name.length > 120 || typeof createdAt !== 'string') throw new Error('Invalid preset metadata.');
  if (!preset.drone || !preset.modulation || !delay) throw new Error('Incomplete preset.');
  validateDelaySettings(delay);
  if (harmony !== undefined) validateHarmonySettings(harmony);
  const primary = validateLayerSound(preset.drone, preset.modulation);
  const mix = preset.layerMix === undefined ? createDefaultLayerMix() : preset.layerMix;
  if (!mix || typeof mix.firstLayerEnabled !== 'boolean' || typeof mix.secondLayer?.enabled !== 'boolean' || !mix.secondLayer.harmony) throw new Error('Invalid preset layer mix.');
  validateMasterGain(mix.masterGain);
  validateHarmonySettings(mix.secondLayer.harmony);
  const secondLayer = {...mix.secondLayer, ...validateLayerSound(mix.secondLayer.drone, mix.secondLayer.modulation)};
  const sourceLayer = preset.sourceLayer === undefined ? 'A' : preset.sourceLayer;
  if (sourceLayer !== 'A' && sourceLayer !== 'B') throw new Error('Invalid preset source layer.');
  return {...preset, schemaVersion, id, name, createdAt, ...primary, delay, harmony, layerMix: {...mix, secondLayer}, sourceLayer};
}
export function createPreset(name: string, drone: DroneSettings, modulation: readonly LowFrequencyOscillatorSettings[], delay: DelaySettings,
  harmony: HarmonySettings = DEFAULT_HARMONY_SETTINGS, layerMix: LayerMix = createDefaultLayerMix(), sourceLayer: DroneLayerId = 'A'): SoundPreset {
  return validatePreset({schemaVersion: 1, id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), drone, modulation, delay, harmony, layerMix, sourceLayer});
}
export function loadPresetSound(preset: SoundPreset, destination: DroneLayer): DroneLayer {
  const source = preset.sourceLayer === 'B'
    ? preset.layerMix.secondLayer
    : {drone: preset.drone, modulation: preset.modulation, harmony: preset.harmony ?? DEFAULT_HARMONY_SETTINGS};
  return {...source, enabled: destination.enabled};
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
