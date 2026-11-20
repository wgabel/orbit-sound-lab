# Patch feature architecture

The patch editor is organized as a vertical feature across the existing application layers. Imports should point inward: presentation uses application commands and domain contracts; infrastructure implements application runtime contracts; domain code stays independent of React and Web Audio.

## Feature map

| Area | Responsibility |
| --- | --- |
| `src/domain/patch/model.ts` | Stable patch, module, port, cable, and layout contracts. |
| `src/domain/patch/module-definitions.ts` | The exhaustive registry for module labels, categories, defaults, ports, and setting validation. |
| `src/domain/patch/connections.ts` | Pure connection rules and cable creation. |
| `src/domain/patch/validation.ts` | Whole-patch invariant checks. |
| `src/domain/patch/arrangement/` | Arrangement model and pure timeline operations. |
| `src/domain/patch/presets/` | Versioned preset model, builders, and factory presets. |
| `src/application/patch/` | Editor commands and playback-facing application contracts. |
| `src/infrastructure/audio/patch/runtime/` | Web Audio module factories, grouped into sources, processors, and routing. |
| `src/infrastructure/audio/patch/playback.ts` | Runtime graph lifecycle and playback implementation. |
| `src/infrastructure/storage/patch/` | Patch preset persistence adapter. |
| `src/presentation/patch-editor/canvas/node/PatchNode.tsx` | Generic node frame, ports, dragging, accessibility, and preview slot. |
| `src/presentation/patch-editor/canvas/previews/` | Module-specific live visualizations. |
| `src/presentation/patch-editor/inspector/modules/` | Module-specific editors grouped by category. |
| `src/presentation/patch-editor/editor/` | Feature coordinator and viewport controls. |

## Adding a module

1. Add its settings and discriminated-union member in `model.ts`.
2. Add one entry to `PATCH_MODULE_DEFINITIONS`. This supplies creation, ports, menu placement, labels, and local validation.
3. Add its Web Audio factory to the relevant runtime category and route it from `create-runtime-module.ts`.
4. Add its focused inspector to the relevant presentation category and route it from `ModuleInspector.tsx`.
5. Add a preview only when the module needs one; the generic `PatchNode` must remain independent of module kinds.
6. Cover the domain definition and runtime behavior with focused tests.

The exhaustive dispatchers intentionally fail TypeScript compilation when a newly added module has not been handled in all required layers.
