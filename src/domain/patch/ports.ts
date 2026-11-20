import { getPatchPorts } from './module-definitions';
import type { Patch, PatchEndpoint, PatchPort } from './model';

export function getPatchPort(patch: Patch, endpoint: PatchEndpoint): PatchPort | undefined {
  const module = patch.modules.find(item => item.id === endpoint.moduleId);
  return module && getPatchPorts(module).find(item => item.id === endpoint.portId);
}
