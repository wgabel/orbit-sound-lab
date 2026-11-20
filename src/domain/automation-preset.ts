import { isAutomationShape, validateAutomation } from './patch-automation';
import type { AutomationPoint, AutomationStepEnvelope, PatchAutomation } from './patch-automation';

export const AUTOMATION_PRESET_NAME_LIMIT = 120;

export interface AutomationPreset {
  readonly kind: 'orbit-automation';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly automation: PatchAutomation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readAutomationSettings(value: unknown): PatchAutomation {
  if (!isRecord(value)) throw new Error('Invalid automation settings.');
  const {duration, mode, shape, points, glide, stepEnvelope} = value;
  if (typeof duration !== 'number' || (mode !== 'loop' && mode !== 'once') ||
      !isAutomationShape(shape) ||
      !Array.isArray(points) || points.length > 32 || typeof glide !== 'number') {
    throw new Error('Invalid automation settings.');
  }
  const automationPoints = points.map((point: unknown): AutomationPoint => {
    if (!isRecord(point) || typeof point.position !== 'number' || typeof point.value !== 'number') {
      throw new Error('Invalid automation point.');
    }
    return {position:point.position,value:point.value};
  });
  const settings: PatchAutomation = {duration,mode,shape,points:automationPoints,glide,
    ...(stepEnvelope === undefined ? {} : {stepEnvelope:readStepEnvelope(stepEnvelope)})};
  validateAutomation(settings);
  return settings;
}

function readStepEnvelope(value: unknown): AutomationStepEnvelope {
  if (!isRecord(value)) throw new Error('Invalid automation step envelope.');
  const {enabled,attack,decay,sustain,release} = value;
  if (typeof enabled !== 'boolean' || typeof attack !== 'number' || typeof decay !== 'number' ||
      typeof sustain !== 'number' || typeof release !== 'number') throw new Error('Invalid automation step envelope.');
  return {enabled,attack,decay,sustain,release};
}

export function readAutomationPreset(value: unknown): AutomationPreset {
  if (!isRecord(value) || value.kind !== 'orbit-automation' || value.schemaVersion !== 1) {
    throw new Error('Choose a supported Automation preset JSON file.');
  }
  const {id,name,createdAt,automation} = value;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > AUTOMATION_PRESET_NAME_LIMIT) {
    throw new Error('Enter a preset name up to 120 characters.');
  }
  if (typeof id !== 'string' || !id || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid automation preset metadata.');
  }
  return {kind:'orbit-automation',schemaVersion:1,id,name:name.trim(),createdAt,automation:readAutomationSettings(automation)};
}
