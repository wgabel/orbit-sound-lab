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

export interface PatchAutomation {
  readonly duration: number;
  readonly mode: 'loop' | 'once';
  readonly shape: AutomationShape;
  readonly points: readonly AutomationPoint[];
  readonly glide: number;
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
  const nextIndex = settings.points.findIndex(point => point.position > phase);
  if (nextIndex < 1) return settings.points[settings.points.length - 1].value;
  const previous = settings.points[nextIndex - 1];
  const next = settings.points[nextIndex];
  const position = (phase - previous.position) / (next.position - previous.position);
  if (settings.shape === 'smoothCurve') {
    const eased = position * position * (3 - 2 * position);
    return previous.value + (next.value - previous.value) * eased;
  }
  const fraction = settings.shape === 'steps'
    ? settings.glide === 0 ? 0 : Math.max(0, (position - (1 - settings.glide)) / settings.glide)
    : position;
  return previous.value + (next.value - previous.value) * fraction;
}


export function limitAutomationSteps(settings: PatchAutomation, requested: number): PatchAutomation {
  const count = Math.min(settings.points.length-1,Math.max(1,Math.round(requested)));
  if (settings.shape !== 'steps' || count === settings.points.length-1) return settings;
  const end = settings.points[count].position;
  const points = settings.points.slice(0,count).map(point => ({...point,position:point.position/end}));
  return {...settings,points:[...points,{position:1,value:points[count-1].value}]};
}
