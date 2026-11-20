import { useCallback, useEffect, useRef, useState } from 'react';
import { ENVELOPE_MAX_SECONDS, ENVELOPE_MIN_SECONDS, MAX_DRONE_BEND_CENTS } from '@domain/drone-envelope';
import type { DroneEnvelope } from '@domain/drone-envelope';
import type { DroneLayerId } from '@domain/drone-layers';
import { NumericSlider } from './NumericSlider';

interface DroneKeyControlsProps {
  readonly id: DroneLayerId;
  readonly envelope: DroneEnvelope;
  readonly disabled: boolean;
  readonly onEnvelopeChange: (envelope: DroneEnvelope) => void;
  readonly onPress: () => void;
  readonly onRelease: () => void;
  readonly onBend: (cents: number) => void;
}

const BEND_TRAVEL_PIXELS = 80;
type KeyPress = {pointerId: number; startY: number} | {key: string};

export function DroneKeyControls({id, envelope, disabled, onEnvelopeChange, onPress, onRelease, onBend}: DroneKeyControlsProps) {
  const press = useRef<KeyPress | null>(null);
  const releaseCallback = useRef(onRelease);
  const [pressed, setPressed] = useState(false);

  const release = useCallback(() => {
    if (!press.current) return;
    press.current = null;
    setPressed(false);
    releaseCallback.current();
  }, []);

  useEffect(() => { releaseCallback.current = onRelease; }, [onRelease]);
  useEffect(() => {
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, [release]);
  useEffect(() => { if (disabled) release(); }, [disabled, release]);

  return <div className="drone-key-controls">
    <button type="button" className="drone-key" data-pressed={pressed} disabled={disabled} aria-label={`Hold to play Drone ${id}`}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (event.button !== 0 || press.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = {pointerId: event.pointerId, startY: event.clientY};
        setPressed(true);
        onPress();
      }}
      onPointerMove={event => {
        const gesture = press.current;
        if (gesture && 'pointerId' in gesture && gesture.pointerId === event.pointerId) {
          onBend((gesture.startY - event.clientY) / BEND_TRAVEL_PIXELS * MAX_DRONE_BEND_CENTS);
        }
      }}
      onPointerUp={event => { if (press.current && 'pointerId' in press.current && press.current.pointerId === event.pointerId) release(); }}
      onPointerCancel={event => { if (press.current && 'pointerId' in press.current && press.current.pointerId === event.pointerId) release(); }}
      onLostPointerCapture={event => { if (press.current && 'pointerId' in press.current && press.current.pointerId === event.pointerId) release(); }}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (event.repeat || press.current) return;
        press.current = {key: event.key};
        setPressed(true);
        onPress();
      }}
      onKeyUp={event => {
        if (!press.current || !('key' in press.current) || press.current.key !== event.key) return;
        event.preventDefault();
        release();
      }}
      onBlur={() => { if (press.current && 'key' in press.current) release(); }}>
      HOLD TO PLAY <span aria-hidden="true">↕</span>
    </button>
    <fieldset className="drone-envelope">
      <legend>KEY ENVELOPE</legend>
      {(['attack', 'decay', 'sustain', 'release'] as const).map(stage => <NumericSlider key={stage}
        label={stage.toUpperCase()}
        unit={stage === 'sustain' ? '%' : 's'} displayFactor={stage === 'sustain' ? 100 : 1}
        min={stage === 'sustain' ? 0 : ENVELOPE_MIN_SECONDS}
        max={stage === 'sustain' ? 1 : ENVELOPE_MAX_SECONDS} step={0.01}
        value={envelope[stage]} onChange={value => onEnvelopeChange({...envelope, [stage]: value})}/>)}
    </fieldset>
  </div>;
}
