import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { OscillatorStepPlayer } from '@application/oscillator-step-player';
import type { StepPlaybackMode, StepPlayhead } from '@application/oscillator-step-player';
import type { OscillatorStep, StepValue } from '@domain/oscillator-step-sequence';
import type { DroneSettings } from '@domain/drone';

const STEP_UPDATE_INTERVAL_MS = 32;

interface StepPlaybackOptions {
  readonly blocked: boolean;
  readonly drone: DroneSettings;
  readonly readAudioTime: () => number;
  readonly applyValues: (drone: DroneSettings, values: readonly StepValue[]) => DroneSettings;
}

export function useOscillatorStepPlayback({blocked, drone, readAudioTime, applyValues}: StepPlaybackOptions) {
  const [playhead, setPlayhead] = useState<StepPlayhead | null>(null);
  const [error, setError] = useState('');
  const player = useRef<OscillatorStepPlayer | null>(null);
  const interval = useRef<number | undefined>(undefined);
  const current = useRef({drone, readAudioTime, applyValues});

  useLayoutEffect(() => { current.current = {drone, readAudioTime, applyValues}; });

  const clear = useCallback(() => {
    window.clearInterval(interval.current);
    interval.current = undefined;
    player.current = null;
  }, []);

  const stop = useCallback(() => {
    clear();
    setPlayhead(null);
  }, [clear]);

  useLayoutEffect(() => { if (blocked) stop(); }, [blocked, stop]);
  useLayoutEffect(() => clear, [clear]);

  function apply(values: readonly StepValue[]) {
    current.current.drone = current.current.applyValues(current.current.drone, values);
  }

  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'Cannot play oscillator steps.');
    stop();
  }

  function tick() {
    try {
      if (!player.current?.tick(current.current.readAudioTime())) stop();
    } catch (reason) { fail(reason); }
  }

  function start(steps: readonly OscillatorStep[], mode: StepPlaybackMode) {
    if (blocked || player.current) return;
    const sequence = steps.map((step, index) => ({step, index})).filter(({step}) => step.values.length > 0);
    if (!sequence.length) return;
    setError('');
    try {
      const next = new OscillatorStepPlayer(mode, sequence, {
        readDrone: () => current.current.drone,
        applyValues: apply,
        onPlayhead: setPlayhead
      });
      player.current = next;
      if (next.start(current.current.readAudioTime())) interval.current = window.setInterval(tick, STEP_UPDATE_INTERVAL_MS);
      else stop();
    } catch (reason) { fail(reason); }
  }

  function advance() {
    if (!player.current?.canAdvance) return;
    try {
      player.current.advance(current.current.readAudioTime());
      tick();
    } catch (reason) { fail(reason); }
  }

  function recall(values: readonly StepValue[]) {
    setError('');
    try { apply(values); } catch (reason) { fail(reason); }
  }

  return {playhead, error, canAdvance: player.current?.canAdvance, start, stop, advance, recall};
}
