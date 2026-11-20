import { hasPatchCycle } from './cycles';
import { PATCH_MODULE_DEFINITIONS } from './module-definitions';
import type { Patch } from './model';
import { getPatchPort } from './ports';

function within(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validatePatch(patch: Patch): void {
  if (patch.version !== 1 || patch.modules.length > 64 || patch.cables.length > 192) {
    throw new Error('Unsupported patch size or version.');
  }
  if (new Set(patch.modules.map(module => module.id)).size !== patch.modules.length ||
      new Set(patch.cables.map(cable => cable.id)).size !== patch.cables.length) {
    throw new Error('Patch IDs must be unique.');
  }
  for (const module of patch.modules) {
    if (!module.id) throw new Error('A module needs an identifier.');
    PATCH_MODULE_DEFINITIONS[module.kind].validate(module);
  }
  const destinations = new Set<string>();
  for (const {source,destination,mapping,inverted,enabled} of patch.cables) {
    const output = getPatchPort(patch,source);
    const input = getPatchPort(patch,destination);
    if (!output || !input || output.direction !== 'output' || input.direction !== 'input' ||
        output.signal !== input.signal) throw new Error('Choose a compatible input.');
    const destinationKey = JSON.stringify([destination.moduleId,destination.portId]);
    if (destinations.has(destinationKey)) throw new Error('This input already has a cable.');
    destinations.add(destinationKey);
    if ((inverted !== undefined && typeof inverted !== 'boolean') ||
        (enabled !== undefined && typeof enabled !== 'boolean') ||
        (!input.parameter && (inverted !== undefined || enabled !== undefined))) {
      throw new Error('Invalid automation cable controls.');
    }
    if (input.parameter) {
      const {minimum,maximum} = input.parameter;
      if (!mapping || !within(mapping.from,minimum,maximum) || !within(mapping.to,minimum,maximum)) {
        throw new Error(`${input.label} mapping must be between ${minimum} and ${maximum} ${input.parameter.unit}.`);
      }
    } else if (mapping) throw new Error('Only numeric control cables have a parameter mapping.');
  }
  if (hasPatchCycle(patch.cables)) throw new Error('This cable would create a feedback loop.');
}
