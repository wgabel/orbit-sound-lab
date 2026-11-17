import { describe, expect, it, vi } from 'vitest';
import { WebAudioGraph } from './web-audio-graph';
import type { AudioGraphModule, AudioGraphConnection } from '../../application/audio-graph-contracts';
function makeModule(id: string) {
  const output = {connect: vi.fn(), disconnect: vi.fn()} as unknown as AudioNode;
  const input = {} as AudioNode;
  const module: AudioGraphModule = {id, inputs:[{id:'in',node:input}], outputs:[{id:'out',node:output}]};
  return {module, output};
}
const connection = (sourceModuleId: string, destinationModuleId: string): AudioGraphConnection => ({sourceModuleId,sourcePortId:'out',destinationModuleId,destinationPortId:'in'});
describe('WebAudioGraph', () => {
  it('connects only once and disconnects only its own edge', () => {
    const graph = new WebAudioGraph(); const a = makeModule('a'); const b = makeModule('b');
    graph.register(a.module); graph.register(b.module);
    graph.connect(connection('a','b')); graph.connect(connection('a','b'));
    expect(a.output.connect).toHaveBeenCalledTimes(1);
    graph.disconnect(connection('a','b'));
    expect(a.output.disconnect).toHaveBeenCalledWith(b.module.inputs[0].node);
  });
  it('rejects cycles and unknown ports', () => {
    const graph = new WebAudioGraph(); const a = makeModule('a'); const b = makeModule('b');
    graph.register(a.module); graph.register(b.module); graph.connect(connection('a','b'));
    expect(() => graph.connect(connection('b','a'))).toThrow('cycles');
    expect(() => graph.connect({...connection('a','b'),destinationPortId:'missing'})).toThrow('Unknown');
  });
  it('disconnects edges on unregister and dispose', () => {
    const graph = new WebAudioGraph(); const a = makeModule('a'); const b = makeModule('b');
    graph.register(a.module); graph.register(b.module); graph.connect(connection('a','b'));
    graph.unregister('b'); expect(a.output.disconnect).toHaveBeenCalledTimes(1);
    graph.dispose(); graph.dispose(); expect(() => graph.register(a.module)).toThrow('disposed');
  });
});
