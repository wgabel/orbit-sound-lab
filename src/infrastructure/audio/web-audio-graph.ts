import type { AudioGraph, AudioGraphConnection, AudioGraphModule, AudioGraphPort } from '@application/audio-graph-contracts';

/** Connects registered modules, rejects cycles, and owns only graph-created connections. */
export class WebAudioGraph implements AudioGraph {
  private readonly modules = new Map<string, AudioGraphModule>();
  private readonly connections = new Map<string, AudioGraphConnection>();
  private disposed = false;

  register(module: AudioGraphModule): void {
    this.assertActive();
    if (!module.id || this.modules.has(module.id)) throw new Error('Audio module identifier must be unique and nonempty.');
    if (new Set(module.inputs.map(port => port.id)).size !== module.inputs.length || new Set(module.outputs.map(port => port.id)).size !== module.outputs.length) throw new Error('Duplicate audio port identifier.');
    this.modules.set(module.id, module);
  }

  connect(connection: AudioGraphConnection): void {
    this.assertActive();
    const key = this.key(connection);
    if (this.connections.has(key)) return;
    const source = this.port(connection.sourceModuleId, connection.sourcePortId, 'outputs');
    const destination = this.port(connection.destinationModuleId, connection.destinationPortId, 'inputs');
    if (connection.sourceModuleId === connection.destinationModuleId || this.reaches(connection.destinationModuleId, connection.sourceModuleId)) throw new Error('Audio graph cycles are not supported.');
    source.node.connect(destination.node);
    this.connections.set(key, connection);
  }

  disconnect(connection: AudioGraphConnection): void {
    this.assertActive();
    const key = this.key(connection);
    if (!this.connections.has(key)) return;
    const source = this.port(connection.sourceModuleId, connection.sourcePortId, 'outputs');
    const destination = this.port(connection.destinationModuleId, connection.destinationPortId, 'inputs');
    source.node.disconnect(destination.node);
    this.connections.delete(key);
  }

  unregister(moduleId: string): void {
    this.assertActive();
    if (!this.modules.has(moduleId)) return;
    for (const connection of [...this.connections.values()]) {
      if (connection.sourceModuleId === moduleId || connection.destinationModuleId === moduleId) this.disconnect(connection);
    }
    this.modules.delete(moduleId);
  }

  dispose(): void {
    if (this.disposed) return;
    for (const connection of [...this.connections.values()]) this.disconnect(connection);
    this.modules.clear();
    this.disposed = true;
  }

  private port(moduleId: string, portId: string, direction: 'inputs' | 'outputs'): AudioGraphPort {
    const module = this.modules.get(moduleId);
    if (!module) throw new Error(`Unknown audio module: ${moduleId}`);
    const port = module[direction].find(item => item.id === portId);
    if (!port) throw new Error(`Unknown ${direction} port: ${moduleId}/${portId}`);
    return port;
  }

  private reaches(from: string, target: string): boolean {
    const visited = new Set<string>();
    const pending = [from];
    while (pending.length) {
      const current = pending.pop()!;
      if (current === target) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const connection of this.connections.values()) if (connection.sourceModuleId === current) pending.push(connection.destinationModuleId);
    }
    return false;
  }

  private key(connection: AudioGraphConnection): string {
    return JSON.stringify([connection.sourceModuleId, connection.sourcePortId, connection.destinationModuleId, connection.destinationPortId]);
  }

  private assertActive(): void { if (this.disposed) throw new Error('Audio graph has been disposed.'); }
}
