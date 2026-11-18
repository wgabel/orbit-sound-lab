import { useId, useState } from 'react';
import { LFO_MAXIMUM_RATE_HZ, LFO_MINIMUM_RATE_HZ } from '../domain/modulation';

const MINIMUM_SECONDS = 1 / LFO_MAXIMUM_RATE_HZ;
const MAXIMUM_SECONDS = 1 / LFO_MINIMUM_RATE_HZ;

interface LfoCycleInputProps {
  readonly destination: 'Pitch' | 'Amplitude';
  readonly rateHz: number;
  readonly disabled: boolean;
  readonly onRateChange: (rateHz: number) => void;
}

export function LfoCycleInput({destination, rateHz, disabled, onRateChange}: LfoCycleInputProps) {
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  function finishEditing(keepInvalid: boolean) {
    if (draft !== null && !disabled) {
      const text = draft.trim().replace(',', '.');
      const seconds = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
      if (seconds >= MINIMUM_SECONDS && seconds <= MAXIMUM_SECONDS) {
        onRateChange(1 / seconds);
      } else if (keepInvalid) {
        setInvalid(true);
        return;
      }
    }
    setDraft(null);
    setInvalid(false);
  }

  return <div className="pitch-lfo-detail">
    <label className="pitch-lfo-cycle">
      <span aria-hidden="true">1 cycle /</span>
      <input className="numeric-slider-entry" type="text" inputMode="decimal" autoComplete="off"
        aria-label={`${destination} LFO cycle duration in seconds`} aria-invalid={invalid && !disabled}
        aria-describedby={invalid && !disabled ? errorId : undefined} disabled={disabled}
        value={disabled || draft === null ? Number((1 / rateHz).toFixed(4)) : draft}
        onFocus={event => event.currentTarget.select()}
        onChange={event => { setDraft(event.target.value); setInvalid(false); }}
        onBlur={() => finishEditing(false)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            finishEditing(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(null);
            setInvalid(false);
          }
        }}/>
      <span aria-hidden="true">s</span>
    </label>
    {invalid && !disabled && <span id={errorId} className="numeric-slider-error" role="alert">
      Enter {MINIMUM_SECONDS} to {MAXIMUM_SECONDS} seconds.
    </span>}
  </div>;
}
