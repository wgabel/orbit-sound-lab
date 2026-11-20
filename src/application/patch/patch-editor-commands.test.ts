import { describe, expect, it } from 'vitest';
import { createExamplePatch, createPatchModule } from '@domain/patch';
import { patchEditorCommands } from './patch-editor-commands';

describe('patch editor commands', () => {
  it('adds a module without mutating the current patch', () => {
    const patch = createExamplePatch();
    const module = createPatchModule('gain', 'extra-gain');

    const next = patchEditorCommands.addModule(patch, module);

    expect(next.modules).toHaveLength(patch.modules.length + 1);
    expect(patch.modules).not.toContain(module);
  });

  it('removes cables attached to a removed module', () => {
    const patch = createExamplePatch();
    const connectedModule = patch.cables[0].source.moduleId;

    const next = patchEditorCommands.remove(patch, {kind: 'module', id: connectedModule});

    expect(next.modules.some(module => module.id === connectedModule)).toBe(false);
    expect(next.cables.some(cable =>
      cable.source.moduleId === connectedModule || cable.destination.moduleId === connectedModule)).toBe(false);
  });
});
