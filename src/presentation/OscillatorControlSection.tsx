import { useId } from 'react';
import type { ReactNode } from 'react';

interface OscillatorControlSectionProps {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

export function OscillatorControlSection({title, action, children}: OscillatorControlSectionProps) {
  const headingId = useId();
  return <div className="oscillator-control-section" role="group" aria-labelledby={headingId}>
    <div className="oscillator-control-section-heading">
      <h3 id={headingId}>{title}</h3>
      {action}
    </div>
    <div className="oscillator-control-section-body">{children}</div>
  </div>;
}
