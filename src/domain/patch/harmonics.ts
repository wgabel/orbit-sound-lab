import type { PatchAutomation } from '@domain/patch/automation';

export interface HarmonicsPreset {
  readonly id: string;
  readonly label: string;
  readonly semitones: readonly [number, ...number[]];
}

interface HarmonicsGroup {
  readonly label: string;
  readonly presets: readonly HarmonicsPreset[];
}

export const HARMONICS_GROUPS: readonly HarmonicsGroup[] = [
  {label:'Chords', presets:[
    {id:'major', label:'Major triad', semitones:[0,4,7,12,7,4]},
    {id:'minor', label:'Minor triad', semitones:[0,3,7,12,7,3]},
    {id:'suspended-fourth', label:'Suspended fourth', semitones:[0,5,7,12,7,5]},
    {id:'major-seventh', label:'Major seventh', semitones:[0,4,7,11,12,11,7,4]},
    {id:'minor-seventh', label:'Minor seventh', semitones:[0,3,7,10,12,10,7,3]},
    {id:'dominant-seventh', label:'Dominant seventh', semitones:[0,4,7,10,12,10,7,4]}
  ]},
  {label:'Scales', presets:[
    {id:'major-scale', label:'Major scale', semitones:[0,2,4,5,7,9,11,12]},
    {id:'minor-pentatonic', label:'Minor pentatonic', semitones:[0,3,5,7,10,12,10,7,5,3]},
    {id:'dorian', label:'Dorian mode', semitones:[0,2,3,5,7,9,10,12]},
    {id:'harmonic-minor', label:'Harmonic minor', semitones:[0,2,3,5,7,8,11,12]}
  ]},
  {label:'Intervals', presets:[
    {id:'fifths-and-octaves', label:'Fifths and octaves', semitones:[0,7,12,7]}
  ]}
];

const presets = HARMONICS_GROUPS.flatMap(group => group.presets);

// Frequency cables interpolate in Hz. A 0–1 signal mapped from a root to twice that root
// therefore needs frequency ratios rather than equally spaced values for semitones.
function stepValue(semitones: number): number {
  return Math.round((2 ** (semitones / 12) - 1) * 100000) / 100000;
}

export function applyHarmonicsPreset(settings: PatchAutomation, presetId: string): PatchAutomation {
  const preset = presets.find(item => item.id === presetId);
  if (!preset) return settings;
  const count = preset.semitones.length;
  const points = preset.semitones.map((semitones, index) => ({position:index / count, value:stepValue(semitones)}));
  return {...settings, shape:'steps', glide:0, points:[...points,{...points[count - 1], position:1}]};
}

export function readHarmonicsPresetId(settings: PatchAutomation): string {
  if (settings.shape !== 'steps' || settings.glide !== 0) return '';
  return presets.find(({semitones}) => {
    const count = semitones.length;
    return settings.points.length === count + 1 &&
      settings.points[count].value === stepValue(semitones[count - 1]) &&
      semitones.every((note, index) =>
        settings.points[index].position === index / count && settings.points[index].value === stepValue(note));
  })?.id ?? '';
}
