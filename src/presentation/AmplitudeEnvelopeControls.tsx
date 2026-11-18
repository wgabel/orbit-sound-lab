import type { OscillatorSettings } from '../domain/drone';

interface AmplitudeEnvelopeControlsProps {
  readonly oscillator: OscillatorSettings;
  readonly playing: boolean;
  readonly onChange: (settings: OscillatorSettings) => void;
  readonly onGateOn: (oscillatorId: string) => void;
  readonly onGateOff: (oscillatorId: string) => void;
}

export function AmplitudeEnvelopeControls({oscillator, playing, onChange, onGateOn, onGateOff}: AmplitudeEnvelopeControlsProps) {
  const envelope = oscillator.envelope;
  function changeEnvelope(update: Partial<OscillatorSettings['envelope']>) {
    onChange({...oscillator, envelope: {...envelope, ...update}});
  }
  return <div className="oscillator-envelope">
    <div className="oscillator-title"><strong>AMPLITUDE ADSR</strong><label className="switch"><input type="checkbox" checked={envelope.enabled} onChange={event => changeEnvelope({enabled: event.target.checked})}/> ACTIVE</label></div>
    <p className="envelope-help">Enable ADSR, then hold GATE to shape this oscillator's volume. Other oscillators keep playing.</p>
    <label>ATTACK <output>{envelope.attackSeconds.toFixed(2)} s</output><input type="range" min="0.01" max="10" step="0.01" value={envelope.attackSeconds} disabled={!envelope.enabled} onChange={event => changeEnvelope({attackSeconds: Number(event.target.value)})}/></label>
    <label>DECAY <output>{envelope.decaySeconds.toFixed(2)} s</output><input type="range" min="0.01" max="10" step="0.01" value={envelope.decaySeconds} disabled={!envelope.enabled} onChange={event => changeEnvelope({decaySeconds: Number(event.target.value)})}/></label>
    <label>SUSTAIN <output>{Math.round(envelope.sustainLevel * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={envelope.sustainLevel} disabled={!envelope.enabled} onChange={event => changeEnvelope({sustainLevel: Number(event.target.value)})}/></label>
    <label>RELEASE <output>{envelope.releaseSeconds.toFixed(2)} s</output><input type="range" min="0.01" max="15" step="0.01" value={envelope.releaseSeconds} disabled={!envelope.enabled} onChange={event => changeEnvelope({releaseSeconds: Number(event.target.value)})}/></label>
    <button className="gate-button" type="button" disabled={!playing || !envelope.enabled || !oscillator.enabled}
      onPointerDown={event => {event.currentTarget.setPointerCapture(event.pointerId); onGateOn(oscillator.id);}}
      onPointerUp={() => onGateOff(oscillator.id)}
      onPointerCancel={() => onGateOff(oscillator.id)}
      onLostPointerCapture={() => onGateOff(oscillator.id)}
      onKeyDown={event => {if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {event.preventDefault(); onGateOn(oscillator.id);}}}
      onKeyUp={event => {if (event.key === ' ' || event.key === 'Enter') {event.preventDefault(); onGateOff(oscillator.id);}}}
      onBlur={() => onGateOff(oscillator.id)}>HOLD GATE</button>
  </div>;
}
