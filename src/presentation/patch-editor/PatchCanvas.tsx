import { findArrangementClipAt, readClipElapsed } from '../../domain/patch-arrangement';
import type { PatchArrangement } from '../../domain/patch-arrangement';
import { AudioWaveform } from '../AudioWaveform';
import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { getInputCable, getPatchModuleLabel, getPatchPorts, PATCH_CANVAS_MINIMUM, sameEndpoint } from '../../domain/patch';
import type { NodePosition, PatchLayout, Patch, PatchCable, PatchEndpoint, PatchModule, PatchPort } from '../../domain/patch';
import { limitAutomationSteps, readAutomationPhase, readAutomationValue } from '../../domain/patch-automation';
import { readLfoPreviewValue, readPatchLfoPhase } from '../../domain/patch-lfo';
import type { PatchLfo } from '../../domain/patch-lfo';
import type { AutomationPlaybackTiming, PatchAutomation } from '../../domain/patch-automation';

import { boundNodePosition, getEdgeScrollSpeed, getVisiblePatchViewport, PATCH_CANVAS_HEIGHT, PATCH_CANVAS_WIDTH,
  PATCH_NODE_WIDTH, PATCH_NODE_TITLE_HEIGHT, PATCH_PORT_HEIGHT } from './patch-layout';

export type PatchSelection = {readonly kind: 'module' | 'cable'; readonly id: string};

export function createExampleLayout(): PatchLayout {
  return {drone:{x:28,y:38}, filter:{x:249,y:38}, gain:{x:470,y:38},
    output:{x:691,y:38}, automation:{x:28,y:231}};
}

interface PatchCanvasProps {
  readonly patch: Patch;
  readonly arrangement?: PatchArrangement;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly scale: number;
  readonly positions: PatchLayout;
  readonly selection: PatchSelection | null;
  readonly pending: PatchEndpoint | null;
  readonly playing: boolean;
  readAudibleElapsed(): number;
  readLfoPhase(moduleId: string, elapsed: number): number | undefined;
  readAutomationTiming(moduleId: string, elapsed: number): AutomationPlaybackTiming | undefined;
  readControlValue(moduleId: string): number | undefined;
  readonly outputLevel: number;
  getWaveformAnalyser(moduleId: string): AnalyserNode | null;
  onSelect(selection: PatchSelection): void;
  onCableChange(cable: PatchCable): void;
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

function controlPath(readValue: (phase: number) => number): string {
  return Array.from({length:129}, (_, index) => {
    const phase = index / 128;
    return `${index === 0 ? 'M' : 'L'}${phase * 140},${29 - 26 * readValue(phase)}`;
  }).join(' ');
}

function AutomationScope({moduleId, settings}: {moduleId: string; settings: PatchAutomation}) {
  const path = useMemo(() => controlPath(phase => readAutomationValue(settings,phase)), [settings]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="Automation shape and playhead">
    <path d={path} data-automation-curve=""/><line data-automation-playhead={moduleId} x1="0" x2="0" y1="0" y2="32"/>
  </svg>;
}

function LfoScope({moduleId, settings}: {moduleId: string; settings: PatchLfo}) {
  const {waveform} = settings;
  const path = useMemo(() => waveform === 'smoothRandom' ? '' :
    controlPath(phase => readLfoPreviewValue(waveform,phase)), [waveform]);
  return <svg className="patch-scope" viewBox="0 0 140 32" role="img" aria-label="LFO shape and playhead">
    <path d={path} data-lfo-random-trace={waveform === 'smoothRandom' ? '' : undefined}/>
    <line data-automation-playhead={moduleId} x1="0" x2="0" y1="0" y2="32"/>
  </svg>;
}

interface NodeDrag {
  readonly id: string;
  readonly pointer: number;
  readonly offset: NodePosition;
  pointerPosition: NodePosition;
  lastFrame?: number;
}

export function PatchCanvas({patch, arrangement, positions, selection, pending, scale, playing, readAudibleElapsed, readLfoPhase, readAutomationTiming, readControlValue, getWaveformAnalyser, outputLevel, viewportRef,
  onSelect, onCableChange, onPort, canConnect, onMove}: PatchCanvasProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const controlBadges = useRef(new Map<string,HTMLSpanElement>());
  const drag = useRef<NodeDrag | null>(null);
  const dragFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(dragFrame.current), []);
  const modules = new Map(patch.modules.map(module => [module.id, module]));
  const connectedInputs = new Set(patch.cables.filter(cable => cable.destination.portId === 'in')
    .map(cable => cable.destination.moduleId));
  const connectedControlSources = new Set(patch.cables.filter(cable => cable.mapping)
    .map(cable => cable.source.moduleId));
  const selectedCable = selection?.kind === 'cable'
    ? patch.cables.find(cable => cable.id === selection.id) : undefined;
  const controlCable = selectedCable?.mapping ? selectedCable : undefined;
  useEffect(() => {
    const modulesById = new Map(patch.modules.map(module => [module.id,module]));
    const lines = canvas.current?.querySelectorAll<SVGLineElement>('[data-automation-playhead]');
    if (!lines?.length) return;
    const playheads = Array.from(lines, line => {
      const module = modulesById.get(line.dataset.automationPlayhead ?? '');
      const trace = line.parentElement?.querySelector<SVGPathElement>('[data-lfo-random-trace]');
      const curve = line.parentElement?.querySelector<SVGPathElement>('[data-automation-curve]');
      const clips = arrangement?.clips.filter(clip => clip.moduleId === module?.id);
      trace?.setAttribute('d','');
      return {line,module,trace,curve,clips,settings:undefined as PatchAutomation | undefined,stepCount:undefined as number | undefined,lastColumn:-1,history:''};
    });
    let frame = 0;
    let lastBadgeUpdate = -Infinity;
    function draw(timestamp: number) {
      const elapsed = playing ? readAudibleElapsed() : 0;
      const updateBadges = timestamp - lastBadgeUpdate >= 80;
      if (updateBadges) lastBadgeUpdate = timestamp;
      for (const playhead of playheads) {
        const {line,module,trace,curve,clips} = playhead;
        if (!module || (module.kind !== 'automation' && module.kind !== 'lfo')) continue;
        const clip = clips && findArrangementClipAt(clips,elapsed);
        let phase: number;
        if (module.kind === 'automation') {
          const settings = clip?.automation ?? module.settings;
          const timing = playing ? readAutomationTiming(module.id,elapsed) : undefined;
          if (curve && (playhead.settings !== settings || playhead.stepCount !== timing?.stepCount)) {
            const visible = timing?.stepCount === undefined ? settings : limitAutomationSteps(settings,timing.stepCount);
            curve.setAttribute('d',controlPath(value => readAutomationValue(visible,value)));
            playhead.settings = settings;
            playhead.stepCount = timing?.stepCount;
          }
          phase = timing?.phase ?? readAutomationPhase(settings,clip ? readClipElapsed(clip,elapsed) : clips ? 0 : elapsed);
        } else {
          phase = (playing ? readLfoPhase(module.id,elapsed) : undefined) ?? readPatchLfoPhase(module.settings,elapsed);
        }
        const badge = updateBadges ? controlBadges.current.get(module.id) : undefined;
        const sample = playing && (badge || trace) ? readControlValue(module.id) : undefined;
        if (badge) badge.textContent = sample?.toFixed(2) ?? '—';
        const x = String(140 * phase);
        line.setAttribute('x1',x);
        line.setAttribute('x2',x);
        if (trace && sample !== undefined) {
          const column = Math.floor(140 * phase);
          if (column === playhead.lastColumn) continue;
          if (column < playhead.lastColumn) playhead.history = '';
          const y = Math.round(29 - 26 * sample);
          playhead.history += `${playhead.history ? 'L' : 'M'}${column},${y} `;
          playhead.lastColumn = column;
          trace.setAttribute('d',playhead.history);
        }
      }
      if (playing) frame = requestAnimationFrame(draw);
    }
    draw(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [patch.modules, arrangement, playing, readAudibleElapsed, readLfoPhase, readAutomationTiming, readControlValue]);

  function endpointPosition(endpoint: PatchEndpoint) {
    const module = modules.get(endpoint.moduleId);
    const point = positions[endpoint.moduleId];
    const port = module && getPatchPorts(module).find(item => item.id === endpoint.portId);
    return module && point && port ? portPosition(module, point, port) : null;
  }

  function getCanvasPoint(pointer: NodePosition): NodePosition | undefined {
    const bounds = canvas.current?.getBoundingClientRect();
    if (!bounds) return;
    return {
      x:PATCH_CANVAS_MINIMUM + (pointer.x-bounds.left)/scale,
      y:PATCH_CANVAS_MINIMUM + (pointer.y-bounds.top)/scale
    };
  }

  function moveNode(moving: NodeDrag) {
    const point = getCanvasPoint(moving.pointerPosition);
    if (point) onMove(moving.id,boundNodePosition({x:point.x-moving.offset.x,y:point.y-moving.offset.y}));
  }

  function scrollWhileDragging(timestamp: number) {
    const moving = drag.current;
    const viewport = viewportRef.current;
    if (!moving || !viewport) return;
    const {x,y} = moving.pointerPosition;
    const rectangle = viewport.getBoundingClientRect();
    const visible = getVisiblePatchViewport(viewport);
    const elapsed = Math.min(0.05,(timestamp - (moving.lastFrame ?? timestamp-16)) / 1000);
    moving.lastFrame = timestamp;
    const horizontal = getEdgeScrollSpeed(x,rectangle.left+viewport.clientLeft+visible.x,visible.width);
    const vertical = getEdgeScrollSpeed(y,rectangle.top+viewport.clientTop+visible.y,visible.height);
    const beforeScroll = {x:viewport.scrollLeft,y:viewport.scrollTop};
    if (horizontal || vertical) viewport.scrollBy(horizontal*elapsed,vertical*elapsed);
    if (viewport.scrollLeft !== beforeScroll.x || viewport.scrollTop !== beforeScroll.y) moveNode(moving);
    dragFrame.current = requestAnimationFrame(scrollWhileDragging);
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, id: string, position: NodePosition) {
    if (event.button !== 0 || drag.current) return;
    const pointerPosition = {x:event.clientX,y:event.clientY};
    const point = getCanvasPoint(pointerPosition);
    if (!point) return;
    drag.current = {id,pointer:event.pointerId,offset:{x:point.x-position.x,y:point.y-position.y},pointerPosition};
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const moving = drag.current;
    if (!moving || moving.pointer !== event.pointerId) return;
    moving.pointerPosition = {x:event.clientX,y:event.clientY};
    moveNode(moving);
    if (!dragFrame.current) dragFrame.current = requestAnimationFrame(scrollWhileDragging);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
  }

  return <div ref={viewportRef} className="patch-viewport" tabIndex={0} aria-label="Patch canvas. Scroll in any direction.">
    <div className="patch-stage" style={{width:PATCH_CANVAS_WIDTH*scale,height:PATCH_CANVAS_HEIGHT*scale}}>
      <div ref={canvas} className="patch-canvas"
        style={{width:PATCH_CANVAS_WIDTH,height:PATCH_CANVAS_HEIGHT,transform:`scale(${scale})`}}>
        <svg className="patch-cables" width={PATCH_CANVAS_WIDTH} height={PATCH_CANVAS_HEIGHT}
          viewBox={`${PATCH_CANVAS_MINIMUM} ${PATCH_CANVAS_MINIMUM} ${PATCH_CANVAS_WIDTH} ${PATCH_CANVAS_HEIGHT}`}
          aria-label="Patch cables">
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
              <path d={path} data-signal={input?.signal} className="patch-wire"
                data-selected={cable === selectedCable} data-disabled={cable.enabled === false}/>
              <path d={path} className="patch-wire-hit" role="button" tabIndex={0}
                aria-label={`${getPatchModuleLabel(sourceModule)} to ${getPatchModuleLabel(destinationModule)} ${input?.label}${cable.enabled === false ? ' (disabled)' : ''}`}
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
          return <article key={module.id} data-node-id={module.id} aria-label={getPatchModuleLabel(module)} className="patch-node"
            data-selected={highlighted} style={{
              left:position.x-PATCH_CANVAS_MINIMUM,top:position.y-PATCH_CANVAS_MINIMUM,width:PATCH_NODE_WIDTH
            }}>
            <button className="patch-node-title" type="button"
              onClick={() => onSelect({kind:'module',id:module.id})}
              onPointerDown={event => beginDrag(event,module.id,position)}
              onPointerMove={moveDrag}
              onLostPointerCapture={finishDrag}>{getPatchModuleLabel(module)}</button>
            <div className="patch-port-columns">
              {(['input','output'] as const).map(direction => <div key={direction} className={`patch-port-column ${direction}`}>
                {portsOnSide(module,direction).map(port => {
                  const endpoint = {moduleId:module.id,portId:port.id};
                  const label = `${getPatchModuleLabel(module)} ${port.label}${port.signal !== 'audio' ? ` ${port.direction}` : ''}`;
                  const compatible = Boolean(pending && canConnect(endpoint));
                  const current = compatible ? getInputCable(patch,endpoint) : undefined;
                  const replacing = Boolean(current && pending && !sameEndpoint(current.source,pending));
                  return <div className="patch-port-row" key={port.id} data-signal={port.signal}>
                    <button className="patch-port" type="button" aria-label={label}
                      title={replacing ? `Replace connection to ${label}` : label}
                      data-pending={Boolean(pending && sameEndpoint(pending,endpoint))}
                      data-compatible={compatible} data-replacing={replacing}
                      onClick={() => onPort(endpoint,port)}/>
                    <span>{port.label}</span>
                    {port.direction === 'output' && port.signal === 'control' && connectedControlSources.has(module.id) &&
                      <span className="patch-control-value" title="Normalized signal before cable mapping"
                        ref={badge => {
                          if (badge) controlBadges.current.set(module.id,badge);
                          else controlBadges.current.delete(module.id);
                        }}>—</span>}
                    {controlCable && port.direction === 'output' && sameEndpoint(controlCable.source,endpoint) &&
                      <div className="patch-cable-controls" role="group" aria-label="Selected automation cable">
                        <button type="button" aria-pressed={controlCable.inverted === true}
                          title="Invert the selected cable’s control signal"
                          onClick={() => onCableChange({...controlCable,inverted:!controlCable.inverted})}>Flip</button>
                        <button type="button" aria-label="Enable automation cable" aria-pressed={controlCable.enabled !== false}
                          title="Enable or bypass the selected cable"
                          onClick={() => onCableChange({...controlCable,enabled:controlCable.enabled === false})}>
                          {controlCable.enabled === false ? 'Off' : 'On'}
                        </button>
                      </div>}
                  </div>;
                })}
              </div>)}
            </div>
            {module.kind === 'automation' && <AutomationScope moduleId={module.id} settings={module.settings}/>}
            {module.kind === 'lfo' && <LfoScope moduleId={module.id} settings={module.settings}/>}
            {module.kind === 'oscilloscope' && <AudioWaveform sourceId={module.id} playing={playing}
              enabled={connectedInputs.has(module.id)} getAnalyser={getWaveformAnalyser}
              label="Live oscilloscope waveform" disabledLabel="No input" verticalZoom={4}/>}
            {module.kind === 'output' && <meter className="patch-meter" aria-label="Output level"
              min={0} max={1} value={Math.min(1,outputLevel * 5)}/>}
          </article>;
        })}
      </div>
    </div>
  </div>;
}
