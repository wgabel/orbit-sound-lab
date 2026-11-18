export type SliderScale = 'linear' | 'logarithmic' | 'quadratic';

export function getSliderPosition(value: number, minimum: number, maximum: number, scale: SliderScale): number {
  const bounded = Math.max(minimum, Math.min(maximum, value));
  const fraction = (bounded - minimum) / (maximum - minimum);
  if (scale === 'logarithmic') return Math.log(bounded / minimum) / Math.log(maximum / minimum);
  if (scale === 'quadratic') return Math.sqrt(fraction);
  return fraction;
}

export function getSliderValue(position: number, minimum: number, maximum: number, scale: SliderScale): number {
  if (position <= 0) return minimum;
  if (position >= 1) return maximum;
  if (scale === 'logarithmic') return minimum * (maximum / minimum) ** position;
  const fraction = scale === 'quadratic' ? position ** 2 : position;
  return minimum + (maximum - minimum) * fraction;
}
