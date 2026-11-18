import { NumericSlider } from './NumericSlider';

interface OscillatorPanControlProps {
  readonly oscillatorId: string;
  readonly oscillatorNumber: number;
  readonly pan: number;
  readonly onChange: (pan: number) => void;
}

export function OscillatorPanControl({oscillatorId, oscillatorNumber, pan, onChange}: OscillatorPanControlProps) {
  return <NumericSlider id={`${oscillatorId}-pan`} label="PAN" value={pan} min={-1} max={1} step={0.01}
    unit="%" displayFactor={100} onChange={onChange}
    action={<button className="numeric-slider-value" type="button" onClick={() => onChange(0)}
      aria-label={`Center pan for oscillator ${oscillatorNumber}`} title="Center pan">C</button>}/>;
}
