/** Audio routing is separate from control-voltage/parameter modulation. */
export interface AudioGraphPort { readonly id: string; readonly node: AudioNode; }
export interface AudioGraphModule {
  readonly id: string;
  readonly inputs: readonly AudioGraphPort[];
  readonly outputs: readonly AudioGraphPort[];
}
export interface AudioGraphConnection {
  readonly sourceModuleId: string;
  readonly sourcePortId: string;
  readonly destinationModuleId: string;
  readonly destinationPortId: string;
}
export interface AudioGraph {
  register(module: AudioGraphModule): void;
  connect(connection: AudioGraphConnection): void;
  disconnect(connection: AudioGraphConnection): void;
  unregister(moduleId: string): void;
  dispose(): void;
}
