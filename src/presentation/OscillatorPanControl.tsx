interface OscillatorPanControlProps {
  readonly oscillatorId: string;
  readonly oscillatorNumber: number;
  readonly pan: number;
  readonly onChange: (pan: number) => void;
}

export function OscillatorPanControl({oscillatorId, oscillatorNumber, pan, onChange}: OscillatorPanControlProps) {
  const inputId = `${oscillatorId}-pan`;
  const distance = Math.round(Math.abs(pan) * 100);
  const direction = pan < 0 ? 'left' : 'right';
  const position = distance === 0 ? 'Center' : `${distance}% ${direction}`;

  return <div>
    <div className="oscillator-pan-header">
      <label htmlFor={inputId}>PAN</label>
      <button type="button" onClick={() => onChange(0)}
        aria-label={`Center pan for oscillator ${oscillatorNumber}`} title="Center pan">
        {distance === 0 ? 'C' : `${direction === 'left' ? 'L' : 'R'} ${distance}`}
      </button>
    </div>
    <input id={inputId} type="range" min="-1" max="1" step="0.01" value={pan}
      aria-valuetext={position} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}
