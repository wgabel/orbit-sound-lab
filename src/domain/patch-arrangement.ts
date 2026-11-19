import { readAutomationSettings } from './automation-preset';
import type { PatchAutomation } from './patch-automation';
import type { Patch, PatchModule } from './patch';

export const MAX_ARRANGEMENT_SECONDS = 3600;
export const MIN_CLIP_SECONDS = 0.05;
export const MAX_ARRANGEMENT_CLIPS = 128;
export const MAX_ARRANGEMENT_SECTIONS = 32;

export interface ArrangementClip {
  readonly id: string;
  readonly moduleId: string;
  readonly start: number;
  readonly duration: number;
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly level: number;
  readonly phase?: 'restart' | 'continue';
  readonly automation?: PatchAutomation;
}

export interface ArrangementSection {
  readonly id: string;
  readonly name: string;
  readonly start: number;
  readonly duration: number;
}

export interface PatchArrangement {
  readonly sections: readonly ArrangementSection[];
  readonly clips: readonly ArrangementClip[];
  readonly tail: number;
  readonly trackNames?: Readonly<Record<string,string>>;
}

export const EMPTY_PATCH_ARRANGEMENT: PatchArrangement = {sections:[],clips:[],tail:2};

export function isArrangementTrack(module: PatchModule): boolean {
  return ['wave','drone','chord','automation','chordProgression'].includes(module.kind);
}

export function readArrangementEnd(arrangement: PatchArrangement): number {
  return Math.max(0,...arrangement.sections.map(section => section.start + section.duration),
    ...arrangement.clips.map(clip => clip.start + clip.duration));
}

export function findArrangementClipAt(clips: readonly ArrangementClip[], time: number): ArrangementClip | undefined {
  return clips.find(clip => clip.start <= time && time < clip.start + clip.duration);
}

export function readClipElapsed(clip: ArrangementClip, time: number): number {
  return clip.phase === 'continue' ? time : time - clip.start;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Arrangement values must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function readText(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error('Invalid arrangement name or ID.');
  return value;
}

function readSpan(value: Record<string, unknown>) {
  const start = readNumber(value.start,0,MAX_ARRANGEMENT_SECONDS - MIN_CLIP_SECONDS);
  const duration = readNumber(value.duration,MIN_CLIP_SECONDS,MAX_ARRANGEMENT_SECONDS - start);
  return {id:readText(value.id,128),start,duration};
}

export function readPatchArrangement(value: unknown, patch: Patch): PatchArrangement {
  if (!isRecord(value) || !Array.isArray(value.sections) || !Array.isArray(value.clips) ||
      value.sections.length > MAX_ARRANGEMENT_SECTIONS || value.clips.length > MAX_ARRANGEMENT_CLIPS) {
    throw new Error('Invalid arrangement or arrangement size.');
  }
  const modules = new Map(patch.modules.filter(isArrangementTrack).map(module => [module.id,module]));
  const sections = (value.sections as unknown[]).map(section => {
    if (!isRecord(section)) throw new Error('Invalid arrangement section.');
    return {...readSpan(section),name:readText(section.name,60)};
  }).sort((first,second) => first.start - second.start);
  const clips = (value.clips as unknown[]).map((clip): ArrangementClip => {
    if (!isRecord(clip)) throw new Error('Invalid arrangement clip.');
    const moduleId = readText(clip.moduleId,128);
    const module = modules.get(moduleId);
    if (!module) throw new Error('Choose a Wave, Drone, Chord Generator, Automation, or Chord Progression node for the clip.');
    const span = readSpan(clip);
    const fadeIn = readNumber(clip.fadeIn,0,span.duration);
    const fadeOut = readNumber(clip.fadeOut,0,span.duration);
    if (fadeIn + fadeOut > span.duration + 1e-8) throw new Error('The fades must fit inside the clip.');
    const base = {...span,moduleId,fadeIn,fadeOut,level:readNumber(clip.level,0,1)};
    if (clip.automation !== undefined && module.kind !== 'automation') {
      throw new Error('Curve settings require an Automation node.');
    }
    if (clip.phase !== undefined && module.kind !== 'automation' && module.kind !== 'chordProgression') {
      throw new Error('Phase settings require an Automation node or a Chord Progression node.');
    }
    if (clip.phase !== undefined && clip.phase !== 'restart' && clip.phase !== 'continue') {
      throw new Error('Choose a valid automation phase mode.');
    }
    return {...base,...(clip.phase ? {phase:clip.phase} : {}),
      ...(clip.automation === undefined ? {} : {automation:readAutomationSettings(clip.automation)})};
  }).sort((first,second) => first.start - second.start);
  if (new Set([...sections,...clips].map(item => item.id)).size !== sections.length + clips.length) {
    throw new Error('Arrangement IDs must be unique.');
  }
  if (sections.some((section,index) => index > 0 && sections[index-1].start + sections[index-1].duration > section.start + 1e-8)) {
    throw new Error('Sections cannot overlap.');
  }
  const trackEnds = new Map<string,number>();
  for (const clip of clips) {
    if ((trackEnds.get(clip.moduleId) ?? 0) > clip.start + 1e-8) throw new Error('Clips on the same track cannot overlap.');
    trackEnds.set(clip.moduleId,clip.start + clip.duration);
  }
  let trackNames: Record<string,string> | undefined;
  if (value.trackNames !== undefined) {
    if (!isRecord(value.trackNames)) throw new Error('Invalid arrangement track names.');
    trackNames = Object.fromEntries(Object.entries(value.trackNames).map(([id,label]) => {
      if (!modules.has(id)) throw new Error('An arrangement track name needs a source node.');
      return [id,readText(label,60)];
    }));
  }
  return {sections,clips,tail:readNumber(value.tail,0,30),...(trackNames && Object.keys(trackNames).length ? {trackNames} : {})};
}

export function duplicateArrangementSection(arrangement: PatchArrangement, section: ArrangementSection,
  nextId: () => string): PatchArrangement {
  const start = readArrangementEnd(arrangement);
  const clips = arrangement.clips.filter(clip => clip.start >= section.start - 1e-8 &&
    clip.start + clip.duration <= section.start + section.duration + 1e-8);
  return {...arrangement,
    sections:[...arrangement.sections,{...section,id:nextId(),name:`${section.name.slice(0,59)}′`,start}],
    clips:[...arrangement.clips,...clips.map(clip => ({...clip,id:nextId(),start:start + (clip.start - section.start)}))]
  };
}
