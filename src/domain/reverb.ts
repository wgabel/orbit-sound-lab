export interface ReverbSpace {
  readonly decaySeconds: number;
  readonly preDelayMilliseconds: number;
  readonly damping: number;
}

export interface ReverbSettings extends ReverbSpace {
  readonly mix: number;
}

export interface DroneReverbSettings extends Partial<ReverbSpace> {
  readonly enabled: boolean;
  readonly mix: number;
}

export const MINIMUM_REVERB_DECAY_SECONDS = 0.2;
export const MAXIMUM_REVERB_DECAY_SECONDS = 12;
export const MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS = 250;

export const DEFAULT_REVERB: ReverbSettings = {
  decaySeconds: 1.8,
  preDelayMilliseconds: 18,
  damping: 0,
  mix: 0.25
};

export const REVERB_PRESETS = [
  {name: 'Concrete Room', settings: {decaySeconds: 0.65, preDelayMilliseconds: 8, damping: 0.2, mix: 0.38}},
  {name: 'Dark Hall', settings: {decaySeconds: 4.2, preDelayMilliseconds: 36, damping: 0.72, mix: 0.58}},
  {name: 'Flooded Cavern', settings: {decaySeconds: 9, preDelayMilliseconds: 62, damping: 0.5, mix: 0.78}}
] as const;

export function resolveReverb(settings: DroneReverbSettings): ReverbSettings {
  return {
    decaySeconds: settings.decaySeconds === undefined ? DEFAULT_REVERB.decaySeconds : settings.decaySeconds,
    preDelayMilliseconds: settings.preDelayMilliseconds === undefined ? DEFAULT_REVERB.preDelayMilliseconds : settings.preDelayMilliseconds,
    damping: settings.damping === undefined ? DEFAULT_REVERB.damping : settings.damping,
    mix: settings.mix
  };
}

function within(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validateReverb(settings: ReverbSettings): void {
  if (!within(settings.mix,0,1)) throw new Error('Reverb mix must be between 0 and 1.');
  if (!within(settings.decaySeconds,MINIMUM_REVERB_DECAY_SECONDS,MAXIMUM_REVERB_DECAY_SECONDS)) {
    throw new Error('Reverb decay must be between 0.2 and 12 seconds.');
  }
  if (!within(settings.preDelayMilliseconds,0,MAXIMUM_REVERB_PRE_DELAY_MILLISECONDS)) {
    throw new Error('Reverb pre-delay must be between 0 and 250 milliseconds.');
  }
  if (!within(settings.damping,0,1)) throw new Error('Reverb damping must be between 0 and 1.');
}

export function validateDroneReverb(settings: DroneReverbSettings): void {
  if (typeof settings?.enabled !== 'boolean') throw new Error('Invalid drone reverb switch.');
  validateReverb(resolveReverb(settings));
}
