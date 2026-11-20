import { hasPatchCycle } from './cycles';
import type { Patch, PatchCable, PatchEndpoint } from './model';
import { getPatchPort } from './ports';
import { validatePatch } from './validation';

export function sameEndpoint(first: PatchEndpoint, second: PatchEndpoint): boolean {
  return first.moduleId === second.moduleId && first.portId === second.portId;
}

export function getInputCable(patch: Patch, destination: PatchEndpoint): PatchCable | undefined {
  return patch.cables.find(cable => sameEndpoint(cable.destination,destination));
}

function replaceInputCable(patch: Patch, cable: PatchCable): readonly PatchCable[] {
  return [...patch.cables.filter(existing => !sameEndpoint(existing.destination,cable.destination)),cable];
}

export function canConnectPatchPorts(patch: Patch, source: PatchEndpoint, destination: PatchEndpoint): boolean {
  const output = getPatchPort(patch,source);
  const input = getPatchPort(patch,destination);
  return output?.direction === 'output' && input?.direction === 'input' && output.signal === input.signal &&
    !hasPatchCycle(replaceInputCable(patch,{id:'pending',source,destination}));
}

export function connectPatchPorts(patch: Patch, id: string, source: PatchEndpoint,
  destination: PatchEndpoint): Patch {
  const current = getInputCable(patch,destination);
  if (current && sameEndpoint(current.source,source)) return patch;
  const parameter = getPatchPort(patch,destination)?.parameter;
  const mapping = current?.mapping ??
    (parameter ? {from:parameter.minimum,to:parameter.defaultMaximum ?? parameter.maximum} : undefined);
  const cable = {id,source,destination,mapping,...(current?.inverted === undefined ? {} : {inverted:current.inverted})};
  const next = {...patch,cables:replaceInputCable(patch,cable)};
  validatePatch(next);
  return next;
}
