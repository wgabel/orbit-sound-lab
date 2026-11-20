import { getPatchModuleLabel } from '@domain/patch';
import type { NodePosition, PatchCable, PatchModule, PatchPort } from '@domain/patch';

export interface PatchCableViewProps {
  readonly cable: PatchCable;
  readonly sourceModule: PatchModule;
  readonly destinationModule: PatchModule;
  readonly destinationPort?: PatchPort;
  readonly sourcePosition: NodePosition;
  readonly destinationPosition: NodePosition;
  readonly selected: boolean;
  onSelect(): void;
}

export function PatchCableView({
  cable,
  sourceModule,
  destinationModule,
  destinationPort,
  sourcePosition,
  destinationPosition,
  selected,
  onSelect
}: PatchCableViewProps) {
  const bend = Math.max(32, Math.abs(destinationPosition.x - sourcePosition.x) * 0.46);
  const path = `M ${sourcePosition.x} ${sourcePosition.y} C ${sourcePosition.x+bend} ${sourcePosition.y} ${destinationPosition.x-bend} ${destinationPosition.y} ${destinationPosition.x} ${destinationPosition.y}`;
  const label = `${getPatchModuleLabel(sourceModule)} to ${getPatchModuleLabel(destinationModule)} ${destinationPort?.label}${cable.enabled === false ? ' (disabled)' : ''}`;

  return <g>
    <path d={path} data-signal={destinationPort?.signal} className="patch-wire"
      data-selected={selected} data-disabled={cable.enabled === false}/>
    <path d={path} className="patch-wire-hit" role="button" tabIndex={0}
      aria-label={label} onClick={onSelect} onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect();
      }}/>
  </g>;
}
