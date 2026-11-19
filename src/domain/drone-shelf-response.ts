import type { DroneMixSettings, DroneShelfSettings } from './drone';

export function getShelfFrequencyHz(frequencyHz: number, sampleRate: number): number {
  return Math.min(frequencyHz, sampleRate * 0.49);
}

function getShelfResponseDecibels(shelf: DroneShelfSettings, frequencyHz: number, sampleRate: number, type: 'low' | 'high'): number {
  if (shelf.gainDecibels === 0) return 0;
  // Web Audio uses a shelf slope of 1. Evaluate that shelf's squared
  // magnitude using the bilinear transform's warped frequency ratio.
  const shelfFrequency = getShelfFrequencyHz(shelf.frequencyHz, sampleRate);
  const shelfTangent = Math.tan(Math.PI * shelfFrequency / sampleRate);
  const responseTangent = Math.tan(Math.PI * frequencyHz / sampleRate);
  const ratio = type === 'low' ? responseTangent / shelfTangent : shelfTangent / responseTangent;
  const gain = 10 ** (shelf.gainDecibels / 20);
  const denominator = 1 + gain * ratio ** 4;
  return 10 * Math.log10(1 + (gain ** 2 - 1) / denominator);
}

export function getDroneShelfResponseDecibels(settings: Pick<DroneMixSettings, 'lowShelf' | 'highShelf'>,
  frequencyHz: number, sampleRate: number): number {
  return getShelfResponseDecibels(settings.lowShelf, frequencyHz, sampleRate, 'low') +
    getShelfResponseDecibels(settings.highShelf, frequencyHz, sampleRate, 'high');
}
