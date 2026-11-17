import { describe, expect, it, vi } from 'vitest';
import { WebAudioModulationMatrix } from './web-audio-modulation-matrix';
import type { ModulationSource, ModulationDestination } from '../../application/modulation-contracts';
describe('modulation matrix', () => {
  it('connects once and disconnects on disposal', () => {
    const output = {connect:vi.fn(),disconnect:vi.fn()} as unknown as AudioNode;
    const source = {output} as ModulationSource;
    const destination: ModulationDestination = {id:'pitch',parameter:{} as AudioParam};
    const matrix = new WebAudioModulationMatrix();
    matrix.connect(source,destination); matrix.connect(source,destination);
    expect(output.connect).toHaveBeenCalledTimes(1);
    matrix.dispose(); expect(output.disconnect).toHaveBeenCalledWith(destination.parameter);
  });
});
