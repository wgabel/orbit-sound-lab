import { useEffect, useRef } from 'react';
/** Diagnostic only: keeps the browser rendering pipeline active without React re-renders. */
export function useRenderingActivityDiagnostic(enabled: boolean): React.RefObject<HTMLDivElement | null> {
  const indicator = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) { if (indicator.current) indicator.current.style.transform = ''; return; }
    let frame = 0;
    let active = true;
    const animate = (timestamp: number) => {
      if (!active) return;
      if (indicator.current) indicator.current.style.transform = `translateX(${Math.sin(timestamp / 400) * 36}px)`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { active = false; cancelAnimationFrame(frame); if (indicator.current) indicator.current.style.transform = ''; };
  }, [enabled]);
  return indicator;
}
