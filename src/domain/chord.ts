/** Equal-tempered chord voicings, independent of the audio engine. */
export const CHORD_TYPES = ['major','minor','diminished','augmented','sus2','sus4','major7','minor7','dominant7','minor9'] as const;
export type ChordType = typeof CHORD_TYPES[number];
export interface ChordSettings {
  readonly rootNote: number; // MIDI note, C4 = 60
  readonly chord: ChordType;
  readonly inversion: number;
  readonly octave: number;
  readonly spread: number;
}
const INTERVALS: Readonly<Record<ChordType,readonly number[]>> = {
  major:[0,4,7], minor:[0,3,7], diminished:[0,3,6], augmented:[0,4,8],
  sus2:[0,2,7], sus4:[0,5,7], major7:[0,4,7,11], minor7:[0,3,7,10],
  dominant7:[0,4,7,10], minor9:[0,3,7,10,14]
};
export const DEFAULT_CHORD_SETTINGS: ChordSettings = {rootNote:48,chord:'major',inversion:0,octave:0,spread:0};
export function getMaximumChordInversion(chord: ChordType): number {
  return INTERVALS[chord].length - 1;
}

export function isLegacyTriadInversion(chord: unknown, inversion: unknown): boolean {
  return inversion === 3 && typeof chord === 'string' && Object.hasOwn(INTERVALS,chord) &&
    getMaximumChordInversion(chord as ChordType) === 2;
}

export function validateChordSettings(settings: ChordSettings): void {
  if (!settings || !Number.isInteger(settings.rootNote) || settings.rootNote < 36 || settings.rootNote > 72 ||
    !CHORD_TYPES.includes(settings.chord) || !Number.isInteger(settings.inversion) || settings.inversion < 0 || settings.inversion > getMaximumChordInversion(settings.chord) ||
    !Number.isInteger(settings.octave) || settings.octave < -1 || settings.octave > 1 ||
    !Number.isInteger(settings.spread) || settings.spread < 0 || settings.spread > 1)
    throw new Error('Invalid Chord Generator settings.');
}
export function getChordMidiNotes(settings: ChordSettings): readonly number[] {
  validateChordSettings(settings);
  const notes = [...INTERVALS[settings.chord]];
  const bass = notes[settings.inversion];
  for (let index = 0; index < settings.inversion; index++) {
    while (notes[index] < bass) notes[index] += 12;
  }
  notes.sort((first,second)=>first-second);
  return notes.map((interval,index)=>settings.rootNote + settings.octave*12 + interval + index*settings.spread*12);
}
export function getChordFrequencies(settings: ChordSettings): readonly number[] {
  return getChordMidiNotes(settings).map(note=>440*Math.pow(2,(note-69)/12));
}
export function getNoteName(note: number): string {
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  return names[((note%12)+12)%12]+(Math.floor(note/12)-1);
}
