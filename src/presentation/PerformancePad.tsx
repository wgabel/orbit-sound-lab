import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { PerformancePosition } from '@domain/performance-pad';
import { NEUTRAL_PERFORMANCE_POSITION } from '@domain/performance-pad';

interface PerformancePadProps {
  readonly onChange: (position: PerformancePosition) => void;
}

function clampPosition(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function PerformancePad({onChange}: PerformancePadProps) {
  const [position, setPosition] = useState(NEUTRAL_PERFORMANCE_POSITION);

  function moveTo(next: PerformancePosition) {
    setPosition(next);
    onChange(next);
  }

  function moveToPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    moveTo({
      blend: clampPosition((event.clientX - rect.left) / rect.width),
      brightness: clampPosition(1 - (event.clientY - rect.top) / rect.height)
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let {blend, brightness} = position;
    switch (event.key) {
      case 'ArrowLeft': blend -= 0.05; break;
      case 'ArrowRight': blend += 0.05; break;
      case 'ArrowDown': brightness -= 0.05; break;
      case 'ArrowUp': brightness += 0.05; break;
      case 'Home':
        event.preventDefault();
        moveTo(NEUTRAL_PERFORMANCE_POSITION);
        return;
      default: return;
    }
    event.preventDefault();
    moveTo({blend: clampPosition(blend), brightness: clampPosition(brightness)});
  }

  return <section className="performance" aria-labelledby="performance-heading">
    <div className="performance-header">
      <h2 id="performance-heading">XY PAD</h2>
      <button type="button" className="randomize-button" onClick={() => moveTo(NEUTRAL_PERFORMANCE_POSITION)}>RESET</button>
    </div>
    <div className="performance-label">BRIGHT</div>
    <div className="performance-field">
      <span>A</span>
      <div
        className="performance-pad"
        role="group"
        tabIndex={0}
        aria-label="XY performance pad"
        aria-describedby="performance-keys"
        onKeyDown={handleKeyDown}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveToPointer(event);
        }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveToPointer(event); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveToPointer(event); }}
      >
        <span className="performance-cursor" aria-hidden="true" style={{
          left: `${position.blend * 100}%`, top: `${(1 - position.brightness) * 100}%`
        }}/>
      </div>
      <span>B</span>
    </div>
    <div className="performance-label">DARK</div>
    <p id="performance-keys" className="performance-key-hint">Arrow keys to move · Home to reset</p>
  </section>;
}
