import { memo, useId } from 'react';
import { MAX_SHELF_FREQUENCY_HZ, MAX_SHELF_GAIN_DECIBELS, MIN_SHELF_FREQUENCY_HZ } from '../domain/drone';
import type { DroneMixSettings } from '../domain/drone';
import { getDroneShelfResponseDecibels, getShelfFrequencyHz } from '../domain/drone-shelf-response';

interface DroneShelfResponseProps {
  readonly settings: Pick<DroneMixSettings, 'lowShelf' | 'highShelf'>;
  readonly sampleRate?: number;
}

const plot = {left: 34, right: 352, top: 13, bottom: 110};
const sampleCount = 128;

function formatGain(decibels: number): string {
  return decibels > 0 ? `+${decibels}` : String(decibels).replace('-', '−');
}

export const DroneShelfResponse = memo(function DroneShelfResponse({settings, sampleRate = 48000}: DroneShelfResponseProps) {
  const descriptionId = useId();
  const minimum = MIN_SHELF_FREQUENCY_HZ;
  const maximum = Math.min(MAX_SHELF_FREQUENCY_HZ, sampleRate / 2);
  const frequencyRatio = maximum / minimum;
  const responseAt = (frequencyHz: number) => getDroneShelfResponseDecibels(settings, frequencyHz, sampleRate);
  const points = Array.from({length: sampleCount + 1}, (_, index) => {
    const frequencyHz = minimum * frequencyRatio ** (index / sampleCount);
    return {frequencyHz, gain: responseAt(frequencyHz)};
  });
  const maxGain = Math.max(...points.map(({gain}) => Math.abs(gain)));
  const gainScale = maxGain > MAX_SHELF_GAIN_DECIBELS + 0.001 ? 2 * MAX_SHELF_GAIN_DECIBELS : MAX_SHELF_GAIN_DECIBELS;
  const positionX = (frequencyHz: number) => plot.left +
    Math.log(frequencyHz / minimum) / Math.log(frequencyRatio) * (plot.right - plot.left);
  const positionY = (gain: number) => plot.top + (1 - gain / gainScale) * (plot.bottom - plot.top) / 2;
  const responseLine = points.map(({frequencyHz, gain}, index) =>
    `${index === 0 ? 'M' : 'L'}${positionX(frequencyHz).toFixed(2)},${positionY(gain).toFixed(2)}`).join(' ');
  const zeroLine = positionY(0);
  const frequencyTicks = [20, 100, 500, 2000, maximum];
  const markers = [
    {label: 'Low shelf', color: 'low', ...settings.lowShelf},
    {label: 'High shelf', color: 'high', ...settings.highShelf}
  ];
  const describeShelf = ({label, frequencyHz, gainDecibels}: typeof markers[number]) =>
    `${label}, ${formatGain(gainDecibels)} dB at ${getShelfFrequencyHz(frequencyHz, sampleRate)} Hz`;

  return <figure className="drone-shelf-response">
    <figcaption>Shelf EQ response</figcaption>
    <svg viewBox="0 0 374 135" role="img" aria-label="Combined shelf EQ response" aria-describedby={descriptionId}>
      <desc id={descriptionId}>{markers.map(describeShelf).join('. ')}. Frequency in Hz, gain in dB.</desc>
      {[-gainScale, -gainScale / 2, 0, gainScale / 2, gainScale].map(gain => {
        const y = positionY(gain);
        return <g key={gain}>
          <line className={gain === 0 ? 'shelf-response-zero' : 'shelf-response-grid'} x1={plot.left} x2={plot.right} y1={y} y2={y}/>
          <text x={plot.left - 5} y={y} textAnchor="end" dominantBaseline="central">{formatGain(gain)}</text>
        </g>;
      })}
      {frequencyTicks.map(frequencyHz => {
        const x = positionX(frequencyHz);
        return <g key={frequencyHz}>
          <line className="shelf-response-grid" x1={x} x2={x} y1={plot.top} y2={plot.bottom}/>
          <text x={x} y={125} textAnchor="middle">{frequencyHz >= 1000 ? `${frequencyHz / 1000}k` : frequencyHz}</text>
        </g>;
      })}
      <text x={8} y={125}>dB</text>
      <text x={367} y={125} textAnchor="middle">Hz</text>
      <path className="shelf-response-fill" d={`${responseLine} L${plot.right},${zeroLine} L${plot.left},${zeroLine} Z`}/>
      <path className="shelf-response-curve" d={responseLine}/>
      {markers.map(marker => {
        const frequency = getShelfFrequencyHz(marker.frequencyHz, sampleRate);
        const x = positionX(frequency);
        return <g className={`shelf-response-marker ${marker.color}`} key={marker.color}>
          <title>{describeShelf(marker)}</title>
          <line x1={x} x2={x} y1={plot.top} y2={plot.bottom}/>
          <circle cx={x} cy={positionY(responseAt(frequency))} r={3.5}/>
        </g>;
      })}
    </svg>
  </figure>;
});
