import { readPatchArrangement } from '@domain/patch/arrangement';
import type { PatchArrangement } from '@domain/patch/arrangement';
import { readAutomationSettings } from '@domain/automation-preset';
import { isLegacyTriadInversion } from '@domain/chord';
import { validateLowFrequencyOscillatorBank } from '@domain/modulation';
import type { LowFrequencyOscillatorSettings } from '@domain/modulation';
import { MAXIMUM_NODE_POSITION, MINIMUM_NODE_POSITION, MODULE_LABELS, PATCH_CANVAS_MINIMUM, validatePatch } from '@domain/patch';
import type { NodePosition, Patch, PatchLayout } from '@domain/patch';

export const PATCH_PRESET_NAME_LIMIT = 120;

export interface PatchSnapshot {
  readonly patch: Patch;
  readonly layout: PatchLayout;
  readonly viewport: NodePosition;
  readonly arrangement?: PatchArrangement;
}

export interface PatchPreset extends PatchSnapshot {
  readonly kind: 'orbit-patch';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isEndpoint(value: unknown): boolean {
  return isRecord(value) && isIdentifier(value.moduleId) && isIdentifier(value.portId);
}

function assertDroneSnapshot(settings: Record<string, unknown>): void {
  const {voice,modulation,copiedFrom} = settings;
  if (!isRecord(voice) || !Array.isArray(voice.oscillators) ||
      (copiedFrom !== undefined && copiedFrom !== 'A' && copiedFrom !== 'B')) {
    throw new Error('Invalid Drone settings.');
  }
  const oscillatorIds = voice.oscillators.map((oscillator: unknown) => {
    if (!isRecord(oscillator) || !isIdentifier(oscillator.id) || typeof oscillator.enabled !== 'boolean' ||
        !isRecord(oscillator.filter) || typeof oscillator.filter.enabled !== 'boolean') {
      throw new Error('Invalid Drone oscillator.');
    }
    return oscillator.id;
  });
  if (modulation === undefined) return;
  if (!Array.isArray(modulation) || !modulation.every(item => isRecord(item) && typeof item.enabled === 'boolean')) {
    throw new Error('Invalid Drone modulation bank.');
  }
  validateLowFrequencyOscillatorBank(modulation as LowFrequencyOscillatorSettings[],oscillatorIds);
}

function readPatch(value: unknown): Patch {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.modules) || !Array.isArray(value.cables) ||
      value.modules.length > 64 || value.cables.length > 192) {
    throw new Error('Unsupported patch size or version.');
  }
  const modules = (value.modules as readonly unknown[]).map(module => {
    if (!isRecord(module) || !isIdentifier(module.id) || typeof module.kind !== 'string' ||
        !Object.hasOwn(MODULE_LABELS,module.kind) || !isRecord(module.settings)) {
      throw new Error('Invalid patch module.');
    }
    if (module.kind === 'automation') readAutomationSettings(module.settings);
    if (module.kind === 'drone') assertDroneSnapshot(module.settings);
    if (module.kind === 'wave' && (typeof module.settings.shape !== 'number' ||
        !Number.isFinite(module.settings.shape) || module.settings.shape < 0 || module.settings.shape > 1)) {
      throw new Error('Invalid Wave shape.');
    }
    // Previous presets could save inversion 3 for a triad, which played in root position.
    return module.kind === 'chord' && isLegacyTriadInversion(module.settings.chord,module.settings.inversion)
      ? {...module,settings:{...module.settings,inversion:0}} : module;
  });
  for (const cable of value.cables as readonly unknown[]) {
    if (!isRecord(cable) || !isIdentifier(cable.id) || !isEndpoint(cable.source) || !isEndpoint(cable.destination) ||
        (cable.mapping !== undefined && !isRecord(cable.mapping))) throw new Error('Invalid patch cable.');
  }
  const patch = {...value,modules} as unknown as Patch;
  try {
    validatePatch(patch);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Invalid patch settings.');
    throw error;
  }
  return patch;
}

function readPosition(value: unknown, minimum: number, maximum: number): NodePosition {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' ||
      !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
      value.x < minimum || value.y < minimum || value.x > maximum || value.y > maximum) {
    throw new Error('Invalid patch layout.');
  }
  return {x:value.x,y:value.y};
}

export function readPatchPreset(value: unknown): PatchPreset {
  if (!isRecord(value) || value.kind !== 'orbit-patch' || value.schemaVersion !== 1) {
    throw new Error('Choose a supported Patch preset JSON file.');
  }
  const {id,name,createdAt,layout,viewport} = value;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > PATCH_PRESET_NAME_LIMIT ||
      !isIdentifier(id) || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid patch preset metadata.');
  }
  const patch = readPatch(value.patch);
  if (!isRecord(layout) || Object.keys(layout).length !== patch.modules.length) throw new Error('Invalid patch layout.');
  const positions = Object.fromEntries(patch.modules.map(module =>
    [module.id,readPosition(Object.hasOwn(layout,module.id) ? layout[module.id] : undefined,MINIMUM_NODE_POSITION,MAXIMUM_NODE_POSITION)]));
  return {kind:'orbit-patch',schemaVersion:1,id,name:name.trim(),createdAt,patch:structuredClone(patch),
    layout:positions,viewport:readPosition(viewport,PATCH_CANVAS_MINIMUM,Number.MAX_SAFE_INTEGER),
    ...(value.arrangement === undefined ? {} : {arrangement:readPatchArrangement(value.arrangement,patch)})};
}
