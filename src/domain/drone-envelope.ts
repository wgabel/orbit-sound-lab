export interface DroneEnvelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

export const ENVELOPE_MIN_SECONDS = 0.02;
export const ENVELOPE_MAX_SECONDS = 8;

export const DEFAULT_DRONE_ENVELOPE: DroneEnvelope = {
  attack: 0.10, decay: 0.20, sustain: 0.75, release: 0.35
};

export function validateDroneEnvelope(envelope: DroneEnvelope): void {
  if (!envelope || ![envelope.attack, envelope.decay, envelope.release].every(
    value => Number.isFinite(value) && value >= ENVELOPE_MIN_SECONDS && value <= ENVELOPE_MAX_SECONDS
  ) || !Number.isFinite(envelope.sustain) || envelope.sustain < 0 || envelope.sustain > 1) {
    throw new Error('Invalid drone volume envelope.');
  }
}

export const MAX_DRONE_BEND_CENTS = 100;
