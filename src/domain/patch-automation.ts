export interface AutomationPoint {
  readonly position: number;
  readonly value: number;
}

export const MINIMUM_AUTOMATION_DURATION = 0.05;
export const MAXIMUM_AUTOMATION_DURATION = 60;
export const MAXIMUM_AUTOMATION_STEPS = 31;

const AUTOMATION_SHAPES = ['sine','square','curve','smoothCurve','steps'] as const;
type AutomationShape = typeof AUTOMATION_SHAPES[number];

export function isAutomationShape(value: unknown): value is AutomationShape {
  return AUTOMATION_SHAPES.some(shape => shape === value);
}

export interface AutomationPlaybackTiming {
  readonly phase: number;
  readonly stepCount?: number;
}

export interface AutomationStepEnvelope {
  readonly enabled: boolean;
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

type TimedEnvelopeStage = 'attack' | 'decay' | 'release';

export function setAutomationEnvelopeTime(envelope: AutomationStepEnvelope, stage: TimedEnvelopeStage, value: number): AutomationStepEnvelope {
  const occupied = (['attack','decay','release'] as const)
    .reduce((total,other) => other === stage ? total : total + envelope[other],0);
  return {...envelope,[stage]:Math.max(0,Math.min(value,1 - occupied))};
}

export const DEFAULT_AUTOMATION_STEP_ENVELOPE: AutomationStepEnvelope = {
  enabled:false, attack:0.15, decay:0.2, sustain:0.65, release:0.25
};

export interface PatchAutomation {
  readonly duration: number;
  readonly mode: 'loop' | 'once';
  readonly shape: AutomationShape;
  readonly points: readonly AutomationPoint[];
  readonly glide: number;
  readonly stepEnvelope?: AutomationStepEnvelope;
}

export function validateAutomation(settings: PatchAutomation): void {
  if (!Number.isFinite(settings.duration) || settings.duration < MINIMUM_AUTOMATION_DURATION || settings.duration > MAXIMUM_AUTOMATION_DURATION ||
      !['loop', 'once'].includes(settings.mode) || !isAutomationShape(settings.shape) ||
      !isNormalized(settings.glide) || settings.points.length < 2 || settings.points.length > MAXIMUM_AUTOMATION_STEPS + 1 ||
      settings.points[0].position !== 0 || settings.points.at(-1)?.position !== 1 ||
      settings.points.some(({position, value}, index) =>
        !isNormalized(position) || !isNormalized(value) ||
        (index > 0 && position <= settings.points[index - 1].position))) {
    throw new Error('Automation needs ordered points from 0 to 1 and a duration between 0.05 and 60 seconds.');
  }
  const envelope = settings.stepEnvelope;
  if (envelope !== undefined && (!envelope || typeof envelope.enabled !== 'boolean' ||
      ![envelope.attack,envelope.decay,envelope.sustain,envelope.release].every(isNormalized) ||
      envelope.attack + envelope.decay + envelope.release > 1 + 1e-12)) {
    throw new Error('Automation step envelope stages must fit within one step, with sustain between 0% and 100%.');
  }
}

function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function readAutomationPhase(settings: PatchAutomation, elapsed: number): number {
  const position = Math.max(0, elapsed) / settings.duration;
  return settings.mode === 'loop' ? position % 1 : Math.min(1, position);
}

export function readAutomationValue(settings: PatchAutomation, phase: number): number {
  if (settings.shape === 'sine') return (1 - Math.cos(phase * Math.PI * 2)) / 2;
  if (settings.shape === 'square') return phase < 0.5 ? 0 : 1;
  const envelope = settings.shape === 'steps' && settings.stepEnvelope?.enabled ? settings.stepEnvelope : undefined;
  const nextIndex = settings.points.findIndex(point => point.position > phase);
  if (nextIndex < 1) return envelope ? 0 : settings.points[settings.points.length - 1].value;
  const previous = settings.points[nextIndex - 1];
  const next = settings.points[nextIndex];
  const position = (phase - previous.position) / (next.position - previous.position);
  if (envelope) return previous.value * readStepEnvelope(envelope,position);
  if (settings.shape === 'smoothCurve') {
    const eased = position * position * (3 - 2 * position);
    return previous.value + (next.value - previous.value) * eased;
  }
  const fraction = settings.shape === 'steps'
    ? settings.glide === 0 ? 0 : Math.max(0, (position - (1 - settings.glide)) / settings.glide)
    : position;
  return previous.value + (next.value - previous.value) * fraction;
}

function readStepEnvelope({attack,decay,sustain,release}: AutomationStepEnvelope, position: number): number {
  if (position < attack) return position / attack;
  if (position < attack + decay) return 1 - (1 - sustain) * (position - attack) / decay;
  if (release > 0 && position >= 1 - release) return sustain * (1 - position) / release;
  return sustain;
}

export function limitAutomationSteps(settings: PatchAutomation, requested: number): PatchAutomation {
  const count = Math.min(settings.points.length-1,Math.max(1,Math.round(requested)));
  if (settings.shape !== 'steps' || count === settings.points.length-1) return settings;
  const end = settings.points[count].position;
  const points = settings.points.slice(0,count).map(point => ({...point,position:point.position/end}));
  return {...settings,points:[...points,{position:1,value:points[count-1].value}]};
}
