import type { PatchCable, PatchModule } from './patch';
import type { PatchSnapshot } from './patch-preset';

interface FactoryPatchPreset extends PatchSnapshot {
  readonly id: string;
  readonly name: string;
}

export interface FactoryPatchGroup {
  readonly label: string;
  readonly presets: readonly FactoryPatchPreset[];
}

type PositionedModule = readonly [module: PatchModule, x: number, y: number];

export function preset(id: string, name: string, nodes: readonly PositionedModule[], cables: readonly PatchCable[]): FactoryPatchPreset {
  return {
    id,name,patch:{version:1,modules:nodes.map(([module]) => module),cables},
    layout:Object.fromEntries(nodes.map(([module,x,y]) => [module.id,{x,y}])),
    viewport:{x:0,y:0}
  };
}

export function mixer(levelA: number, levelB: number): PatchModule {
  return {id:'mixer',kind:'mixer',settings:{levelA,levelB}};
}

export function shelf(lowFrequency: number, lowGain: number, highFrequency: number, highGain: number): PatchModule {
  return {id:'eq',kind:'shelfEq',settings:{
    lowShelf:{frequencyHz:lowFrequency,gainDecibels:lowGain},
    highShelf:{frequencyHz:highFrequency,gainDecibels:highGain}
  }};
}

export function filter(cutoff: number, resonance: number): PatchModule {
  return {id:'filter',kind:'filter',settings:{cutoff,resonance}};
}

export function audio(source: string, destination: string, portId = 'in'): PatchCable {
  return {id:`${source}-${destination}-${portId}`,
    source:{moduleId:source,portId:'out'},destination:{moduleId:destination,portId}};
}

export function control(source: string, destination: string, portId: string, from: number, to: number): PatchCable {
  return {id:`${source}-${destination}-${portId}`,source:{moduleId:source,portId:'control'},
    destination:{moduleId:destination,portId},mapping:{from,to}};
}

export const output: PatchModule = {id:'output',kind:'output',settings:{level:0.85}};
