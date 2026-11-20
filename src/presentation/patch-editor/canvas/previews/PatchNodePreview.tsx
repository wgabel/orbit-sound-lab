import { readSimplexNoise } from '@domain/simplex-noise';
import type { SimplexNoiseSettings } from '@domain/simplex-noise';
import { readAutomationValue } from '@domain/patch/automation';
import type { PatchAutomation } from '@domain/patch/automation';
import { readLfoPreviewValue } from '@domain/patch/lfo';
import type { PatchLfo } from '@domain/patch/lfo';
import type { PatchModule } from '@domain/patch';
import { AudioWaveform } from '@presentation/AudioWaveform';
import { useMemo } from 'react';

export function createControlPath(readValue: (phase: number) => number, segments = 128): string {
  return Array.from({length:segments + 1}, (_, index) => {
    const phase = index / segments;
    return `${index === 0 ? 'M' : 'L'}${phase * 140},${29 - 26 * readValue(phase)}`;
  }).join(' ');
}

export function AutomationPreview({moduleId, settings}: {moduleId: string; settings: PatchAutomation}) {
  const path = useMemo(() => createControlPath(phase => readAutomationValue(settings,phase)), [settings]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="Automation shape and playhead">
    <path d={path} data-automation-curve=""/>
    <line data-automation-playhead={moduleId} x1="0" x2="0" y1="0" y2="32"/>
  </svg>;
}

export function LfoPreview({moduleId, settings}: {moduleId: string; settings: PatchLfo}) {
  const {waveform} = settings;
  const path = useMemo(() => waveform === 'smoothRandom' ? '' :
    createControlPath(phase => readLfoPreviewValue(waveform,phase)), [waveform]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="LFO shape and playhead">
    <path d={path} data-lfo-random-trace={waveform === 'smoothRandom' ? '' : undefined}/>
    <line data-automation-playhead={moduleId} x1="0" x2="0" y1="0" y2="32"/>
  </svg>;
}

export function SimplexNoisePreview({settings}: {settings: SimplexNoiseSettings}) {
  const path = useMemo(() => createControlPath(phase => readSimplexNoise(settings,phase * 8),384),[settings]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="First eight seconds of Simplex Noise">
    <path d={path}/>
  </svg>;
}

export interface PatchNodePreviewProps {
  readonly module: PatchModule;
  readonly playing: boolean;
  readonly inputConnected: boolean;
  readonly outputLevel: number;
  getWaveformAnalyser(moduleId: string): AnalyserNode | null;
}

/** Selects the small visualization owned by a concrete node kind. */
export function PatchNodePreview({
  module,
  playing,
  inputConnected,
  outputLevel,
  getWaveformAnalyser
}: PatchNodePreviewProps) {
  switch (module.kind) {
    case 'automation': return <AutomationPreview moduleId={module.id} settings={module.settings}/>;
    case 'lfo': return <LfoPreview moduleId={module.id} settings={module.settings}/>;
    case 'simplexNoise': return <SimplexNoisePreview settings={module.settings}/>;
    case 'oscilloscope': return <AudioWaveform sourceId={module.id} playing={playing}
      enabled={inputConnected} getAnalyser={getWaveformAnalyser}
      label="Live oscilloscope waveform" disabledLabel="No input" verticalZoom={4}/>;
    case 'output': return <meter className="patch-meter" aria-label="Output level"
      min={0} max={1} value={Math.min(1,outputLevel * 5)}/>;
    default: return null;
  }
}
