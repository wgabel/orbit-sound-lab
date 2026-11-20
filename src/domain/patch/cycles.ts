import type { PatchCable } from './model';

export function hasPatchCycle(cables: readonly PatchCable[]): boolean {
  const children = new Map<string,string[]>();
  for (const {source,destination} of cables) {
    const existing = children.get(source.moduleId);
    if (existing) existing.push(destination.moduleId);
    else children.set(source.moduleId,[destination.moduleId]);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function visit(id: string): boolean {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    for (const child of children.get(id) ?? []) if (visit(child)) return true;
    active.delete(id);
    visited.add(id);
    return false;
  }
  return [...children.keys()].some(visit);
}
