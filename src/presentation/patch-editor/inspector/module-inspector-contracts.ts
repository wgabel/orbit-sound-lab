import type { PatchModule } from '@domain/patch';

export interface PatchModuleInspectorProps<Module extends PatchModule = PatchModule> {
  readonly module: Module;
  readonly sampleRate?: number;
  onChange(module: Module): void;
}
