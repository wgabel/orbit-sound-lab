import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface NumericSliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly unit?: string;
  readonly displayFactor?: number;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly action?: ReactNode;
  readonly modulationRange?: readonly [number, number];
}

const numberDisplay = new Intl.NumberFormat('en', {
  useGrouping: false,
  maximumSignificantDigits: 15
});

export function NumericSlider({
  label, value, min, max, step, onChange, unit, displayFactor = 1,
  disabled = false, className, id, action, modulationRange
}: NumericSliderProps) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const rangeId = `${sliderId}-modulation-range`;
  const errorId = `${sliderId}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const editInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const editing = draft !== null && !disabled;
  const displayedValue = numberDisplay.format(value * displayFactor);
  const unitSuffix = unit === '%' || !unit ? unit ?? '' : ` ${unit}`;
  const displayMinimum = min * displayFactor;
  const displayMaximum = max * displayFactor;

  useLayoutEffect(() => {
    if (editing) {
      editInput.current?.focus();
      editInput.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function finishEditing(save: boolean, fromKeyboard: boolean) {
    if (draft === null) return;
    if (save && !disabled) {
      const text = draft.trim().replace(',', '.');
      const entered = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
      if (entered >= displayMinimum && entered <= displayMaximum) {
        if (text !== displayedValue) onChange(entered / displayFactor);
      } else if (fromKeyboard) {
        setInvalid(true);
        return;
      }
    }
    returnFocus.current = fromKeyboard;
    setDraft(null);
    setInvalid(false);
  }

  function trackPosition(position: number): string {
    return `${Math.max(0, Math.min(100, (position - min) / (max - min) * 100))}%`;
  }
  const rangeStyle = modulationRange && {
    '--modulation-start': trackPosition(modulationRange[0]),
    '--modulation-end': trackPosition(modulationRange[1])
  } as CSSProperties | undefined;

  return <div className={className ? `numeric-slider ${className}` : 'numeric-slider'}>
    <div className="numeric-slider-header">
      <label htmlFor={sliderId}>{label}</label>
      <div className="numeric-slider-actions">
        {editing ? <input
          ref={editInput}
          className="numeric-slider-entry"
          type="text"
          inputMode={min < 0 ? 'text' : 'decimal'}
          autoComplete="off"
          aria-label={`Edit ${label}${unit ? ` (${unit})` : ''}`}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          value={draft}
          onChange={event => { setDraft(event.target.value); setInvalid(false); }}
          onBlur={() => finishEditing(true, false)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              finishEditing(event.key === 'Enter', true);
            }
          }}
        /> : <button
          ref={editButton}
          className="numeric-slider-value"
          type="button"
          aria-label={`Edit ${label}, ${displayedValue}${unitSuffix}`}
          disabled={disabled}
          onClick={() => setDraft(displayedValue)}
        >{displayedValue}{unitSuffix}</button>}
        {action}
      </div>
    </div>
    {invalid && editing && <span className="numeric-slider-error" role="alert" id={errorId}>
      Enter {numberDisplay.format(displayMinimum)} to {numberDisplay.format(displayMaximum)}{unitSuffix}.
    </span>}
    <input type="range" id={sliderId} min={min} max={max} step={step}
      className={modulationRange ? 'numeric-slider-modulated' : undefined} style={rangeStyle}
      value={value} disabled={disabled} aria-valuetext={`${displayedValue}${unitSuffix}`}
      aria-describedby={modulationRange ? rangeId : undefined}
      onChange={event => onChange(event.target.valueAsNumber)}/>
    {modulationRange && <span className="numeric-slider-modulation-range" id={rangeId}>
      {modulationRange.map(limit => numberDisplay.format(Number((limit * displayFactor).toFixed(2))) + unitSuffix).join(' – ')}
    </span>}
  </div>;
}
