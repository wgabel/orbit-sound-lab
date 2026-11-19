import { useMemo } from 'react';
import { MINIMUM_CYCLE_STAGE, readCycleEnvelopeGain, sampleCycleEnvelope } from '../domain/cycle-envelope';
import type { CycleEnvelope } from '../domain/cycle-envelope';
import { NumericSlider } from './NumericSlider';

const PREVIEW_WIDTH = 320;
const PREVIEW_CENTER = 48;
const PREVIEW_SCALE = 40;
const PREVIEW_STEPS = 128;

function tracePath(readValue: (phase: number) => number): string {
  return Array.from({length:PREVIEW_STEPS + 1},(_,index) => {
    const phase = index / PREVIEW_STEPS;
    return `${index ? 'L' : 'M'}${phase * PREVIEW_WIDTH},${(PREVIEW_CENTER - PREVIEW_SCALE * readValue(phase)).toFixed(2)}`;
  }).join(' ');
}

const SINE_PATH = tracePath(phase => Math.sin(2 * Math.PI * phase));

interface CycleEnvelopeControlsProps {
  readonly envelope: CycleEnvelope;
  readonly amount: number;
  onChange(envelope: CycleEnvelope): void;
}

export function CycleEnvelopeControls({envelope,amount,onChange}: CycleEnvelopeControlsProps) {
  const {attack,decay,sustain,release} = envelope;
  const {samples,mean} = useMemo(() => sampleCycleEnvelope(envelope),[envelope]);
  const envelopePath = useMemo(() => tracePath(phase => readCycleEnvelopeGain(envelope,phase)),[envelope]);
  const outputPath = useMemo(() => tracePath(phase => {
    const original = Math.sin(2 * Math.PI * phase);
    const shaped = samples[Math.round(phase * samples.length) % samples.length] - mean;
    return original * (1 - amount) + shaped * amount;
  }),[amount,samples,mean]);

  const availableDuration = (first: number, second: number) => Number((1 - first - second).toFixed(12));
  const sustainDuration = Math.max(0,100 * (1 - attack - decay - release));

  return <section className="cycle-envelope-controls" aria-label="Cycle Envelope">
    <svg className="cycle-envelope-preview" viewBox="0 0 320 96" role="img" aria-label="One cycle showing the sine, envelope, and resulting wave">
      <line x1="0" y1={PREVIEW_CENTER} x2={PREVIEW_WIDTH} y2={PREVIEW_CENTER} className="cycle-envelope-axis"/>
      <path d={SINE_PATH} className="cycle-envelope-sine"/>
      <path d={envelopePath} className="cycle-envelope-gain"/>
      <path d={outputPath} className="cycle-envelope-result"/>
    </svg>
    <div className="cycle-envelope-axis-labels" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    <div className="cycle-envelope-legend">
      <span className="cycle-envelope-sine">Original sine</span>
      <span className="cycle-envelope-gain">Envelope</span>
      <span className="cycle-envelope-result">Result</span>
    </div>
    <div className="cycle-envelope-sliders">
      <NumericSlider label="Attack" unit="%" displayFactor={100} min={MINIMUM_CYCLE_STAGE} max={availableDuration(decay,release)} step={0.01}
        value={attack} onChange={attack => onChange({...envelope,attack})}/>
      <NumericSlider label="Decay" unit="%" displayFactor={100} min={MINIMUM_CYCLE_STAGE} max={availableDuration(attack,release)} step={0.01}
        value={decay} onChange={decay => onChange({...envelope,decay})}/>
      <NumericSlider label="Sustain level" unit="%" displayFactor={100} min={0} max={1} step={0.01}
        value={sustain} onChange={sustain => onChange({...envelope,sustain})}/>
      <NumericSlider label="Release" unit="%" displayFactor={100} min={MINIMUM_CYCLE_STAGE} max={availableDuration(attack,decay)} step={0.01}
        value={release} onChange={release => onChange({...envelope,release})}/>
    </div>
    <p>Sustain lasts {Number(sustainDuration.toFixed(2))}% of the cycle.</p>
  </section>;
}
