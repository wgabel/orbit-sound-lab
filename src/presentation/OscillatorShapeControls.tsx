import { useCallback } from 'react';
import { DEFAULT_OSCILLATOR_SHAPE } from '../domain/drone';
import type { OscillatorSettings } from '../domain/drone';
import { DEFAULT_SHAPE_LFO_DEPTH } from '../domain/modulation';
import type { LowFrequencyOscillatorSettings } from '../domain/modulation';
import { NumericSlider } from './NumericSlider';
import { OscillatorLfoControls } from './OscillatorLfoControls';

interface OscillatorShapeControlsProps {
  readonly oscillator: OscillatorSettings;
  readonly modulation?: LowFrequencyOscillatorSettings;
  readonly readShape: (oscillatorId: string) => number | null;
  readonly playing: boolean;
  readonly onChange: (shape: number) => void;
  readonly onModulationChange: (settings: LowFrequencyOscillatorSettings) => void;
}

export function OscillatorShapeControls({
  oscillator, modulation, readShape, playing, onChange, onModulationChange
}: OscillatorShapeControlsProps) {
  const shape = oscillator.shape ?? DEFAULT_OSCILLATOR_SHAPE;
  const depth = modulation?.depthShape ?? DEFAULT_SHAPE_LFO_DEPTH;
  const readLiveValue = useCallback(() => readShape(oscillator.id), [readShape, oscillator.id]);

  return <>
    <div>
      <NumericSlider label="Shape" unit="%" displayFactor={100} min={0} max={1} step={0.001}
        value={shape} onChange={onChange}
        modulationRange={modulation?.enabled ? [Math.max(0, shape - depth), Math.min(1, shape + depth)] : undefined}
        readLiveValue={playing && modulation?.enabled ? readLiveValue : undefined} showLiveValue/>
      <div className="oscillator-shape-endpoints" aria-hidden="true"><span>Sine</span><span>Triangle</span></div>
    </div>
    {modulation && <OscillatorLfoControls modulation={modulation} onChange={onModulationChange}/>}
  </>;
}
