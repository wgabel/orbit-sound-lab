import { getInputCable, getPatchModuleLabel, getPatchPorts, PATCH_CANVAS_MINIMUM, sameEndpoint } from '@domain/patch';
import type {
  NodePosition,
  Patch,
  PatchCable,
  PatchEndpoint,
  PatchModule,
  PatchPort
} from '@domain/patch';
import type { PointerEvent, ReactNode } from 'react';
import { PATCH_NODE_WIDTH } from '../patch-layout';

export interface PatchNodeProps {
  readonly patch: Patch;
  readonly module: PatchModule;
  readonly position: NodePosition;
  readonly selected: boolean;
  readonly pending: PatchEndpoint | null;
  readonly selectedControlCable?: PatchCable;
  readonly connectedControlSource: boolean;
  readonly preview?: ReactNode;
  canConnect(endpoint: PatchEndpoint): boolean;
  onSelect(): void;
  onPort(endpoint: PatchEndpoint, port: PatchPort): void;
  onCableChange(cable: PatchCable): void;
  onDragStart(event: PointerEvent<HTMLButtonElement>): void;
  onDragMove(event: PointerEvent<HTMLButtonElement>): void;
  onDragEnd(event: PointerEvent<HTMLButtonElement>): void;
  registerControlBadge(moduleId: string, badge: HTMLSpanElement | null): void;
}

export function portsOnSide(module: PatchModule, side: PatchPort['direction']) {
  return getPatchPorts(module).filter(port => port.direction === side);
}

export function PatchNode({
  patch,
  module,
  position,
  selected,
  pending,
  selectedControlCable,
  connectedControlSource,
  preview,
  canConnect,
  onSelect,
  onPort,
  onCableChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  registerControlBadge
}: PatchNodeProps) {
  const label = getPatchModuleLabel(module);

  return <article data-node-id={module.id} aria-label={label} className="patch-node"
    data-selected={selected} style={{
      left:position.x-PATCH_CANVAS_MINIMUM,
      top:position.y-PATCH_CANVAS_MINIMUM,
      width:PATCH_NODE_WIDTH
    }}>
    <button className="patch-node-title" type="button" onClick={onSelect}
      onPointerDown={onDragStart} onPointerMove={onDragMove} onLostPointerCapture={onDragEnd}>
      {label}
    </button>
    <div className="patch-port-columns">
      {(['input','output'] as const).map(direction =>
        <div key={direction} className={`patch-port-column ${direction}`}>
          {portsOnSide(module,direction).map(port => {
            const endpoint = {moduleId:module.id,portId:port.id};
            const portLabel = `${label} ${port.label}${port.signal !== 'audio' ? ` ${port.direction}` : ''}`;
            const compatible = Boolean(pending && canConnect(endpoint));
            const current = compatible ? getInputCable(patch,endpoint) : undefined;
            const replacing = Boolean(current && pending && !sameEndpoint(current.source,pending));
            const controlsSelectedCable = selectedControlCable && port.direction === 'output' &&
              sameEndpoint(selectedControlCable.source,endpoint);

            return <div className="patch-port-row" key={port.id} data-signal={port.signal}>
              <button className="patch-port" type="button" aria-label={portLabel}
                title={replacing ? `Replace connection to ${portLabel}` : portLabel}
                data-pending={Boolean(pending && sameEndpoint(pending,endpoint))}
                data-compatible={compatible} data-replacing={replacing}
                onClick={() => onPort(endpoint,port)}/>
              <span>{port.label}</span>
              {port.direction === 'output' && port.signal === 'control' && connectedControlSource &&
                <span className="patch-control-value" title="Normalized signal before cable mapping"
                  ref={badge => registerControlBadge(module.id,badge)}>—</span>}
              {controlsSelectedCable && <div className="patch-cable-controls" role="group"
                aria-label="Selected automation cable">
                <button type="button" aria-pressed={selectedControlCable.inverted === true}
                  title="Invert the selected cable’s control signal"
                  onClick={() => onCableChange({...selectedControlCable,inverted:!selectedControlCable.inverted})}>
                  Flip
                </button>
                <button type="button" aria-label="Enable automation cable"
                  aria-pressed={selectedControlCable.enabled !== false}
                  title="Enable or bypass the selected cable"
                  onClick={() => onCableChange({...selectedControlCable,enabled:selectedControlCable.enabled === false})}>
                  {selectedControlCable.enabled === false ? 'Off' : 'On'}
                </button>
              </div>}
            </div>;
          })}
        </div>)}
    </div>
    {preview}
  </article>;
}
