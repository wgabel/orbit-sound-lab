import type { ModulationDestination, ModulationMatrix, ModulationSource } from '../../application/modulation-contracts';
export class WebAudioModulationMatrix implements ModulationMatrix {
  private readonly connections = new Map<ModulationSource, Set<ModulationDestination>>();
  private disposed = false;
  connect(source: ModulationSource, destination: ModulationDestination): void {
    this.assertActive();
    const destinations = this.connections.get(source) ?? new Set<ModulationDestination>();
    if (destinations.has(destination)) return;
    source.output.connect(destination.parameter);
    destinations.add(destination);
    this.connections.set(source, destinations);
  }
  disconnect(source: ModulationSource, destination: ModulationDestination): void {
    this.assertActive();
    const destinations = this.connections.get(source);
    if (!destinations?.has(destination)) return;
    source.output.disconnect(destination.parameter);
    destinations.delete(destination);
    if (!destinations.size) this.connections.delete(source);
  }
  dispose(): void {
    if (this.disposed) return;
    for (const [source, destinations] of this.connections) for (const destination of destinations) this.disconnect(source, destination);
    this.disposed = true;
  }
  private assertActive(): void { if (this.disposed) throw new Error('Modulation matrix disposed.'); }
}
