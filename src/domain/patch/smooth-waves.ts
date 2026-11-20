import type { AutomationPoint, PatchAutomation } from '@domain/patch/automation';

interface SmoothWavePreset {
  readonly id: string;
  readonly label: string;
  readonly points: readonly AutomationPoint[];
}

function wave(id: string, label: string, keyframes: readonly (readonly [number, number])[]): SmoothWavePreset {
  return {id,label,points:keyframes.map(([position,value]) => ({position,value}))};
}

export const SMOOTH_WAVE_PRESETS: readonly SmoothWavePreset[] = [
  wave('slow-breath','Slow Breath',[[0,0.1],[0.5,0.9],[1,0.1]]),
  wave('soft-swell','Soft Swell',[[0,0.08],[0.76,0.94],[1,0.08]]),
  wave('double-tide','Double Tide',[[0,0.1],[0.21,0.95],[0.5,0.12],[0.73,0.55],[1,0.1]]),
  wave('floating-plateau','Floating Plateau',[[0,0.16],[0.32,0.85],[0.66,0.85],[1,0.16]]),
  wave('gentle-drift','Gentle Drift',[[0,0.31],[0.28,0.58],[0.49,0.43],[0.76,0.69],[1,0.31]])
];

export function applySmoothWavePreset(settings: PatchAutomation, id: string): PatchAutomation {
  const preset = SMOOTH_WAVE_PRESETS.find(item => item.id === id);
  return preset ? {...settings,shape:'smoothCurve',points:preset.points.map(point => ({...point}))} : settings;
}

export function readSmoothWavePresetId(settings: PatchAutomation): string {
  if (settings.shape !== 'smoothCurve') return '';
  return SMOOTH_WAVE_PRESETS.find(preset => preset.points.length === settings.points.length &&
    preset.points.every((point,index) => point.position === settings.points[index].position &&
      point.value === settings.points[index].value))?.id ?? '';
}
