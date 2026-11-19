import { useCallback } from 'react';
import { DEFAULT_OSCILLATOR_SHAPE, MAXIMUM_PULSE_WIDTH, MINIMUM_PULSE_WIDTH } from '../domain/drone';
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
  const pulse = oscillator.waveform === 'variablePulse';
  const folded = oscillator.waveform === 'foldedSine';
  const peaked = oscillator.waveform === 'peakedSine';
  const label = pulse ? 'Pulse Width' : folded ? 'Fold Amount' : 'Shape';
  const min = pulse ? MINIMUM_PULSE_WIDTH : 0;
  const max = pulse ? MAXIMUM_PULSE_WIDTH : 1;
  const shape = Math.max(min, Math.min(max, oscillator.shape ?? DEFAULT_OSCILLATOR_SHAPE));
  const depth = modulation?.depthShape ?? DEFAULT_SHAPE_LFO_DEPTH;
  const readLiveValue = useCallback(() => readShape(oscillator.id), [readShape, oscillator.id]);

  return <>
    <div>
      <NumericSlider label={label} unit="%" displayFactor={100} min={min} max={max} step={0.001}
        value={shape} onChange={onChange}
        modulationRange={modulation?.enabled ? [Math.max(min, shape - depth), Math.min(max, shape + depth)] : undefined}
        readLiveValue={playing && modulation?.enabled ? readLiveValue : undefined} showLiveValue/>
      <div className="oscillator-shape-endpoints" aria-hidden="true"><span>{pulse ? 'Narrow pulse' : folded ? 'Clean sine' : 'Sine'}</span><span>{pulse ? 'Wide pulse' : folded ? 'Deep fold' : peaked ? 'Narrow peaks' : 'Triangle'}</span></div>
    </div>
    {modulation && <OscillatorLfoControls modulation={modulation} onChange={onModulationChange}/>}
  </>;
}
