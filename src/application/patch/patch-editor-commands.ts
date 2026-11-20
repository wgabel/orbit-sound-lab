import { getPatchPort, validatePatch } from '@domain/patch';
import type { Patch, PatchCable, PatchModule } from '@domain/patch';

export interface PatchItemReference {
  readonly kind: 'module' | 'cable';
  readonly id: string;
}

/** Pure patch mutations used by the editor before the audio runtime applies a change. */
export interface PatchEditorCommands {
  addModule(patch: Patch, module: PatchModule): Patch;
  updateModule(patch: Patch, module: PatchModule): Patch;
  updateCable(patch: Patch, cable: PatchCable): Patch;
  remove(patch: Patch, item: PatchItemReference): Patch;
}

function checked(patch: Patch): Patch {
  validatePatch(patch);
  return patch;
}

export const patchEditorCommands: PatchEditorCommands = {
  addModule(patch, module) {
    return checked({...patch, modules: [...patch.modules, module]});
  },
  updateModule(patch, module) {
    const next = {...patch, modules: patch.modules.map(item => item.id === module.id ? module : item)};
    const cables = patch.cables.filter(cable =>
      getPatchPort(next, cable.source) && getPatchPort(next, cable.destination));
    return checked({...next, cables});
  },
  updateCable(patch, cable) {
    return checked({...patch, cables: patch.cables.map(item => item.id === cable.id ? cable : item)});
  },
  remove(patch, item) {
    return checked(item.kind === 'module' ? {
      ...patch,
      modules: patch.modules.filter(module => module.id !== item.id),
      cables: patch.cables.filter(cable =>
        cable.source.moduleId !== item.id && cable.destination.moduleId !== item.id)
    } : {
      ...patch,
      cables: patch.cables.filter(cable => cable.id !== item.id)
    });
  }
};
