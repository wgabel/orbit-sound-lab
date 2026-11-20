import { useState } from 'react';
import { createOscillatorStep, hasValidStepTimes, MAX_STEP_SECONDS, readStepValue, STEP_TARGET_LABELS } from '@domain/oscillator-step-sequence';
import type { OscillatorStep, StepTarget, StepValue } from '@domain/oscillator-step-sequence';
import type { DroneSettings } from '@domain/drone';
import type { DroneLayerId } from '@domain/drone-layers';
import { useOscillatorStepPlayback } from './use-oscillator-step-playback';

interface OscillatorStepSequencerProps {
  readonly layerId: DroneLayerId;
  readonly active: boolean;
  readonly canPlay: boolean;
  readonly drone: DroneSettings;
  readonly readAudioTime: () => number;
  readonly applyValues: (drone: DroneSettings, values: readonly StepValue[]) => DroneSettings;
}

const availableParameters = ['volume', 'cutoff', 'frequencyDepth'] as const;
const MAX_STEPS = 8;

function displayStepValue({parameter, value}: StepValue): string {
  return parameter === 'volume' ? `${Number((value * 100).toFixed(1))}%` : `${Number(value.toFixed(1))} Hz`;
}

function isSameControl(first: StepTarget, second: StepTarget) {
  return first.oscillatorId === second.oscillatorId && first.parameter === second.parameter;
}

export function OscillatorStepSequencer({layerId, active, canPlay, drone, readAudioTime, applyValues}: OscillatorStepSequencerProps) {
  const [steps, setSteps] = useState(() => Array.from({length: 4}, createOscillatorStep));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [oscillatorId, setOscillatorId] = useState(drone.oscillators[0].id);
  const [parameter, setParameter] = useState<StepTarget['parameter']>('volume');
  const playback = useOscillatorStepPlayback({blocked: !canPlay || !active, drone, readAudioTime, applyValues});
  const editing = playback.playhead === null;
  const selectedStep = steps[selectedIndex];
  const target = {oscillatorId, parameter};
  const captureValue = readStepValue(drone, target);
  const targetAvailable = (target: StepTarget) => readStepValue(drone, target) !== undefined;
  const playableSteps = steps.filter(step => step.values.length > 0);
  const canStart = canPlay && playableSteps.length > 0 &&
    playableSteps.every(step => hasValidStepTimes(step) && step.values.every(targetAvailable));
  const canLoop = canStart && playableSteps.some(step => step.glideSeconds + step.holdSeconds > 0);
  const titleId = `oscillator-step-sequencer-${layerId}`;

  function updateStep(update: (step: OscillatorStep) => OscillatorStep) {
    setSteps(current => current.map((step, index) => index === selectedIndex ? update(step) : step));
  }

  function capture() {
    if (captureValue === undefined) return;
    updateStep(step => ({
      ...step,
      values: [...step.values.filter(value => !isSameControl(value, target)), {...target, value: captureValue}]
    }));
  }

  function describeTarget(target: StepTarget) {
    return `OSC ${drone.oscillators.findIndex(oscillator => oscillator.id === target.oscillatorId) + 1} ${STEP_TARGET_LABELS[target.parameter]}`;
  }

  return <section className="oscillator-step-sequencer" aria-labelledby={titleId} hidden={!active}>
    <h3 id={titleId}>Step Sequencer · Drone {layerId}</h3>
    <div className="step-pad-row" aria-label="Steps" role="group">
      {steps.map((step, index) => <button key={index} type="button" aria-label={`Step ${index + 1}`}
        aria-pressed={index === selectedIndex} aria-current={playback.playhead?.index === index ? 'step' : undefined}
        onClick={() => setSelectedIndex(index)}>
        <strong>{index + 1}</strong><span>{step.values.length ? `${step.values.length} ${step.values.length === 1 ? 'control' : 'controls'}` : 'Empty'}</span>
      </button>)}
      {steps.length < MAX_STEPS && <button type="button" disabled={!editing} aria-label="Add step" onClick={() => {
        setSelectedIndex(steps.length);
        setSteps(current => [...current, createOscillatorStep()]);
      }}>+ Step</button>}
    </div>
    {!playableSteps.length && <p>Set a value in the oscillator rack, then select that control here and capture it into a step.</p>}
    <fieldset className="step-editor" disabled={!editing}>
      <legend>Step {selectedIndex + 1}</legend>
      <div className="step-editor-controls">
        <label>Glide (s)<input type="number" min={0} max={MAX_STEP_SECONDS} step="any"
          value={Number.isFinite(selectedStep.glideSeconds) ? selectedStep.glideSeconds : ''}
          onChange={event => {
            const glideSeconds = event.target.valueAsNumber;
            updateStep(step => ({...step, glideSeconds}));
          }}/></label>
        <label>Hold (s)<input type="number" min={0} max={MAX_STEP_SECONDS} step="any"
          value={Number.isFinite(selectedStep.holdSeconds) ? selectedStep.holdSeconds : ''}
          onChange={event => {
            const holdSeconds = event.target.valueAsNumber;
            updateStep(step => ({...step, holdSeconds}));
          }}/></label>
        <label>Oscillator<select value={oscillatorId} onChange={event => setOscillatorId(event.target.value)}>
          {drone.oscillators.map((oscillator, index) => <option key={oscillator.id} value={oscillator.id}>OSC {index + 1}</option>)}
        </select></label>
        <label>Control<select value={parameter} onChange={event => setParameter(event.target.value as StepTarget['parameter'])}>
          {availableParameters.map(parameter => <option key={parameter} value={parameter}>{STEP_TARGET_LABELS[parameter]}</option>)}
        </select></label>
        <button type="button" disabled={captureValue === undefined} onClick={capture}>
          {captureValue === undefined ? 'Capture' : `Capture ${displayStepValue({...target, value: captureValue})}`}
        </button>
      </div>
      {captureValue === undefined && <p>{parameter === 'cutoff'
        ? 'Enable this oscillator’s low-pass filter to capture cutoff.'
        : 'Enable a Waveform route to this oscillator’s Frequency to capture FM depth.'}</p>}
      {selectedStep.values.length > 0 && <ul className="step-captured-values">
        {selectedStep.values.map(value => <li key={`${value.oscillatorId}-${value.parameter}`}>
          <span>{describeTarget(value)} · {displayStepValue(value)}{targetAvailable(value) ? '' : ' (unavailable)'}</span>
          <button type="button" aria-label={`Remove ${describeTarget(value)}`}
            onClick={() => updateStep(step => ({...step, values: step.values.filter(item => !isSameControl(item, value))}))}>×</button>
        </li>)}
      </ul>}
      <button type="button" disabled={!selectedStep.values.length || !selectedStep.values.every(targetAvailable)}
        onClick={() => playback.recall(selectedStep.values)}>Apply step</button>
    </fieldset>
    <div className="step-transport">
      {editing ? <>
        <button type="button" disabled={!canStart} onClick={() => playback.start(steps, 'once')}>Play once</button>
        <button type="button" disabled={!canLoop} onClick={() => playback.start(steps, 'loop')}>Loop</button>
        <button type="button" disabled={!canStart} onClick={() => playback.start(steps, 'manual')}>Manual</button>
      </> : <>
        <button type="button" disabled={!playback.canAdvance} onClick={playback.advance}>Next step</button>
        <button type="button" onClick={playback.stop}>Stop steps</button>
      </>}
      <span role="status">{playback.playhead ? `Step ${playback.playhead.index + 1} · ${{
        glide: 'Gliding', hold: 'Holding', waiting: 'Waiting'
      }[playback.playhead.phase]}` : ''}</span>
    </div>
    {!canPlay && <p>Start the selected drone in continuous mode to play the steps.</p>}
    {editing && playableSteps.some(step => !hasValidStepTimes(step)) && <p>Enter glide and hold times from 0 to {MAX_STEP_SECONDS} seconds.</p>}
    {editing && playableSteps.some(step => !step.values.every(targetAvailable)) && <p>Restore the missing filter or FM route, or remove its capture.</p>}
    {playback.error && <p role="alert">{playback.error}</p>}
  </section>;
}
