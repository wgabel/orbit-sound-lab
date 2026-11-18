import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { getSliderPosition, getSliderValue } from './slider-scale';
import type { SliderScale } from './slider-scale';

interface NumericSliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale?: SliderScale;
  readonly onChange: (value: number) => void;
  readonly unit?: string;
  readonly displayFactor?: number;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly action?: ReactNode;
  readonly modulationRange?: readonly [number, number];
  readonly readLiveValue?: () => number | null;
}

const numberDisplay = new Intl.NumberFormat('en', {
  useGrouping: false,
  maximumSignificantDigits: 15
});

export function NumericSlider({
  label, value, min, max, step, scale = 'linear', onChange, unit, displayFactor = 1,
  disabled = false, className, id, action, modulationRange, readLiveValue
}: NumericSliderProps) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const rangeId = `${sliderId}-modulation-range`;
  const errorId = `${sliderId}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const editInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const [liveValue, setLiveValue] = useState<number | null>(null);
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

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || !readLiveValue) {
      setLiveValue(null);
      return;
    }
    let frame = 0;
    let previousTime = -Infinity;
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (entry.isIntersecting) frame = requestAnimationFrame(draw);
    });
    function draw(time: number) {
      if (time - previousTime >= 30) {
        const effective = readLiveValue?.();
        setLiveValue(effective != null ? Number((effective * displayFactor).toFixed(2)) / displayFactor : null);
        previousTime = time;
      }
      frame = requestAnimationFrame(draw);
    }
    observer.observe(slider);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [readLiveValue, displayFactor]);

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

  const nonlinear = scale !== 'linear';
  function trackPosition(position: number): string {
    return `${getSliderPosition(position, min, max, scale) * 100}%`;
  }

  function changeSlider(input: number) {
    if (!nonlinear) {
      onChange(input);
      return;
    }
    const mappedValue = getSliderValue(input, min, max, scale);
    const roundedValue = Number((min + Math.round((mappedValue - min) / step) * step).toPrecision(15));
    onChange(Math.max(min, Math.min(max, roundedValue)));
  }
  const rangeStyle = modulationRange && {
    '--modulation-start': trackPosition(modulationRange[0]),
    '--modulation-end': trackPosition(modulationRange[1])
  } as CSSProperties | undefined;

  const livePreview = readLiveValue ? liveValue : null;
  const slider = <input type="range" id={sliderId} ref={sliderRef} min={nonlinear ? 0 : min} max={nonlinear ? 1 : max} step={nonlinear ? 'any' : step}
    className={modulationRange ? 'numeric-slider-modulated' : undefined} style={rangeStyle}
    value={nonlinear ? getSliderPosition(value, min, max, scale) : value} disabled={disabled}
    aria-valuemin={nonlinear ? displayMinimum : undefined} aria-valuemax={nonlinear ? displayMaximum : undefined}
    aria-valuenow={nonlinear ? Math.max(displayMinimum, Math.min(displayMaximum, value * displayFactor)) : undefined}
    aria-valuetext={`${displayedValue}${unitSuffix}`}
    aria-describedby={modulationRange ? rangeId : undefined}
    onChange={event => changeSlider(event.target.valueAsNumber)}/>;

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
        >{modulationRange && <span className="numeric-slider-base-label" aria-hidden="true">Base </span>}
          {displayedValue}{unitSuffix}</button>}
        {action}
      </div>
    </div>
    {invalid && editing && <span className="numeric-slider-error" role="alert" id={errorId}>
      Enter {numberDisplay.format(displayMinimum)} to {numberDisplay.format(displayMaximum)}{unitSuffix}.
    </span>}
    {modulationRange ? <div className="numeric-slider-track">
      {slider}
      {livePreview !== null && <span className="numeric-slider-live-track" aria-hidden="true">
        <span className="numeric-slider-live-marker" style={{left: trackPosition(livePreview)}}/>
      </span>}
    </div> : slider}
    {modulationRange && <div className="numeric-slider-modulation-feedback">
      <span className="numeric-slider-modulation-range" id={rangeId}>
        Range {modulationRange.map(limit =>
          numberDisplay.format(Number((limit * displayFactor).toFixed(2))) + unitSuffix).join(' – ')}
      </span>
      {livePreview !== null && <span className="numeric-slider-live-value">
        Live {numberDisplay.format(livePreview * displayFactor)}{unitSuffix}
      </span>}
    </div>}
  </div>;
}
