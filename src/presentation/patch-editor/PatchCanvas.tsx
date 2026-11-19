import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent, Ref } from 'react';
import { getPatchModuleLabel, getPatchPorts, sameEndpoint } from '../../domain/patch';
import type { Patch, PatchEndpoint, PatchModule, PatchPort } from '../../domain/patch';
import { readAutomationPhase, readAutomationValue } from '../../domain/patch-automation';
import type { PatchAutomation } from '../../domain/patch-automation';

import { boundNodePosition, PATCH_NODE_WIDTH, PATCH_NODE_TITLE_HEIGHT, PATCH_PORT_HEIGHT } from './patch-layout';
import type { NodePosition, PatchLayout } from './patch-layout';

export type PatchSelection = {readonly kind: 'module' | 'cable'; readonly id: string};

export function createExampleLayout(): PatchLayout {
  return {drone:{x:28,y:38}, filter:{x:249,y:38}, gain:{x:470,y:38},
    output:{x:691,y:38}, automation:{x:28,y:231}};
}

interface PatchCanvasProps {
  readonly patch: Patch;
  readonly viewportRef: Ref<HTMLDivElement>;
  readonly positions: PatchLayout;
  readonly selection: PatchSelection | null;
  readonly pending: PatchEndpoint | null;
  readonly playing: boolean;
  readAudibleElapsed(): number;
  readonly outputLevel: number;
  onSelect(selection: PatchSelection): void;
  onPort(endpoint: PatchEndpoint, port: PatchPort): void;
  canConnect(endpoint: PatchEndpoint): boolean;
  onMove(id: string, position: NodePosition): void;
}

function portsOnSide(module: PatchModule, side: PatchPort['direction']) {
  return getPatchPorts(module).filter(port => port.direction === side);
}

function portPosition(module: PatchModule, position: NodePosition, port: PatchPort): NodePosition {
  const index = portsOnSide(module, port.direction).findIndex(item => item.id === port.id);
  return {x:position.x + (port.direction === 'output' ? PATCH_NODE_WIDTH : 0),
    y:position.y + PATCH_NODE_TITLE_HEIGHT + (index + 0.5) * PATCH_PORT_HEIGHT};
}

function automationPath(settings: PatchAutomation): string {
  const values = Array.from({length:129}, (_, index) => index / 128);
  return values.map((phase, index) =>
    `${index === 0 ? 'M' : 'L'}${phase * 140},${29 - 26 * readAutomationValue(settings, phase)}`).join(' ');
}

function AutomationScope({moduleId, settings}: {moduleId: string; settings: PatchAutomation}) {
  const path = useMemo(() => automationPath(settings), [settings]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="Automation shape and playhead">
    <path d={path}/><line data-automation-playhead={moduleId} x1="0" x2="0" y1="0" y2="32"/>
  </svg>;
}

export function PatchCanvas({patch, positions, selection, pending, playing, readAudibleElapsed, outputLevel, viewportRef,
  onSelect, onPort, canConnect, onMove}: PatchCanvasProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: string; pointer: number; x: number; y: number} | null>(null);
  const modules = new Map(patch.modules.map(module => [module.id, module]));
  const width = Math.max(900, ...Object.values(positions).map(point => point.x + PATCH_NODE_WIDTH + 30));
  const height = Math.max(408, ...Object.values(positions).map(point => point.y + 206));

  useEffect(() => {
    const settingsById = new Map(patch.modules.flatMap(module =>
      module.kind === 'automation' ? [[module.id,module.settings] as const] : []));
    const lines = canvas.current?.querySelectorAll<SVGLineElement>('[data-automation-playhead]');
    if (!lines?.length) return;
    const playheads = Array.from(lines, line => ({line, settings:settingsById.get(line.dataset.automationPlayhead ?? '')}));
    let frame = 0;
    function draw() {
      const elapsed = playing ? readAudibleElapsed() : 0;
      for (const {line,settings} of playheads) {
        if (!settings) continue;
        const x = String(140 * readAutomationPhase(settings, elapsed));
        line.setAttribute('x1',x);
        line.setAttribute('x2',x);
      }
      if (playing) frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, [patch.modules, playing, readAudibleElapsed]);

  function endpointPosition(endpoint: PatchEndpoint) {
    const module = modules.get(endpoint.moduleId);
    const point = positions[endpoint.moduleId];
    const port = module && getPatchPorts(module).find(item => item.id === endpoint.portId);
    return module && point && port ? portPosition(module, point, port) : null;
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, id: string, position: NodePosition) {
    if (event.button !== 0) return;
    drag.current = {id, pointer:event.pointerId, x:event.clientX - position.x, y:event.clientY - position.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const moving = drag.current;
    if (!moving || moving.pointer !== event.pointerId) return;
    onMove(moving.id, boundNodePosition({x:event.clientX - moving.x,y:event.clientY - moving.y}));
  }

  return <div ref={viewportRef} className="patch-viewport" tabIndex={0} aria-label="Patch canvas. Scroll to see more nodes.">
    <div ref={canvas} className="patch-canvas" style={{width,height}}>
      <svg className="patch-cables" width={width} height={height} aria-label="Patch cables">
        {patch.cables.map(cable => {
          const from = endpointPosition(cable.source);
          const to = endpointPosition(cable.destination);
          if (!from || !to) return null;
          const bend = Math.max(32, Math.abs(to.x - from.x) * 0.46);
          const path = `M ${from.x} ${from.y} C ${from.x+bend} ${from.y} ${to.x-bend} ${to.y} ${to.x} ${to.y}`;
          const sourceModule = modules.get(cable.source.moduleId);
          const destinationModule = modules.get(cable.destination.moduleId);
          if (!sourceModule || !destinationModule) return null;
          const input = getPatchPorts(destinationModule).find(port => port.id === cable.destination.portId);
          const select = () => onSelect({kind:'cable',id:cable.id});
          return <g key={cable.id}>
            <path d={path} data-signal={cable.mapping ? 'control' : 'audio'} className="patch-wire"
              data-selected={selection?.kind === 'cable' && selection.id === cable.id}/>
            <path d={path} className="patch-wire-hit" role="button" tabIndex={0}
              aria-label={`${getPatchModuleLabel(sourceModule)} to ${getPatchModuleLabel(destinationModule)} ${input?.label}`}
              onClick={select} onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                select();
              }}/>
          </g>;
        })}
      </svg>
      {patch.modules.map(module => {
        const position = positions[module.id];
        if (!position) return null;
        const highlighted = selection?.kind === 'module' && selection.id === module.id;
        return <article key={module.id} aria-label={getPatchModuleLabel(module)} className="patch-node"
          data-selected={highlighted} style={{left:position.x,top:position.y,width:PATCH_NODE_WIDTH}}>
          <button className="patch-node-title" type="button"
            onClick={() => onSelect({kind:'module',id:module.id})}
            onPointerDown={event => beginDrag(event,module.id,position)}
            onPointerMove={moveDrag}
            onLostPointerCapture={() => {drag.current = null;}}>{getPatchModuleLabel(module)}</button>
          <div className="patch-port-columns">
            {(['input','output'] as const).map(direction => <div key={direction} className={`patch-port-column ${direction}`}>
              {portsOnSide(module,direction).map(port => {
                const endpoint = {moduleId:module.id,portId:port.id};
                const label = `${getPatchModuleLabel(module)} ${port.label}${port.signal === 'control' ? ` ${port.direction}` : ''}`;
                return <div className="patch-port-row" key={port.id} data-signal={port.signal}>
                  <button className="patch-port" type="button" aria-label={label} title={label}
                    data-pending={Boolean(pending && sameEndpoint(pending,endpoint))}
                    data-compatible={Boolean(pending && canConnect(endpoint))}
                    onClick={() => onPort(endpoint,port)}/>
                  <span>{port.label}</span>
                </div>;
              })}
            </div>)}
          </div>
          {module.kind === 'automation' && <AutomationScope moduleId={module.id} settings={module.settings}/>}
          {module.kind === 'output' && <meter className="patch-meter" aria-label="Output level"
            min={0} max={1} value={Math.min(1,outputLevel * 5)}/>}
        </article>;
      })}
    </div>
  </div>;
}
