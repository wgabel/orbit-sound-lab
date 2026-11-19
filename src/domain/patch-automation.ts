export interface AutomationPoint {
  readonly position: number;
  readonly value: number;
}

const AUTOMATION_SHAPES = ['sine','square','curve','smoothCurve','steps'] as const;
type AutomationShape = typeof AUTOMATION_SHAPES[number];

export function isAutomationShape(value: unknown): value is AutomationShape {
  return AUTOMATION_SHAPES.some(shape => shape === value);
}

export interface PatchAutomation {
  readonly duration: number;
  readonly mode: 'loop' | 'once';
  readonly shape: AutomationShape;
  readonly points: readonly AutomationPoint[];
  readonly glide: number;
}

export function validateAutomation(settings: PatchAutomation): void {
  if (!Number.isFinite(settings.duration) || settings.duration < 0.05 || settings.duration > 60 ||
      !['loop', 'once'].includes(settings.mode) || !isAutomationShape(settings.shape) ||
      !isNormalized(settings.glide) || settings.points.length < 2 || settings.points.length > 32 ||
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
