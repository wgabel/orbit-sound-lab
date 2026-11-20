import { findArrangementClipAt, readClipElapsed } from '@domain/patch/arrangement';
import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { getPatchPorts, PATCH_CANVAS_MINIMUM } from '@domain/patch';
import type { NodePosition, PatchLayout, PatchEndpoint, PatchModule, PatchPort } from '@domain/patch';
import { limitAutomationSteps, readAutomationPhase, readAutomationValue } from '@domain/patch/automation';
import type { PatchAutomation } from '@domain/patch/automation';
import { readPatchLfoPhase } from '@domain/patch/lfo';

import { boundNodePosition, getEdgeScrollSpeed, getVisiblePatchViewport, PATCH_CANVAS_HEIGHT, PATCH_CANVAS_WIDTH,
  PATCH_NODE_WIDTH, PATCH_NODE_TITLE_HEIGHT, PATCH_PORT_HEIGHT } from './patch-layout';
import { PatchCableView } from './cable/PatchCableView';
import { PatchNode, portsOnSide } from './node/PatchNode';
import { createControlPath, PatchNodePreview } from './previews/PatchNodePreview';
import type { PatchCanvasProps } from './patch-canvas-contracts';

export type { PatchSelection } from './patch-canvas-contracts';

export function createExampleLayout(): PatchLayout {
  return {drone:{x:28,y:38}, filter:{x:249,y:38}, gain:{x:470,y:38},
    output:{x:691,y:38}, automation:{x:28,y:231}};
}

function portPosition(module: PatchModule, position: NodePosition, port: PatchPort): NodePosition {
  const index = portsOnSide(module, port.direction).findIndex(item => item.id === port.id);
  return {x:position.x + (port.direction === 'output' ? PATCH_NODE_WIDTH : 0),
    y:position.y + PATCH_NODE_TITLE_HEIGHT + (index + 0.5) * PATCH_PORT_HEIGHT};
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
    if (!lines) return;
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
      const elapsed = playing && playheads.length ? readAudibleElapsed() : 0;
      if (timestamp - lastBadgeUpdate >= 80) {
        lastBadgeUpdate = timestamp;
        for (const [moduleId,badge] of controlBadges.current) {
          const sample = playing ? readControlValue(moduleId) : undefined;
          badge.textContent = sample?.toFixed(2) ?? '—';
        }
      }
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
            curve.setAttribute('d',createControlPath(value => readAutomationValue(visible,value)));
            playhead.settings = settings;
            playhead.stepCount = timing?.stepCount;
          }
          phase = timing?.phase ?? readAutomationPhase(settings,clip ? readClipElapsed(clip,elapsed) : clips ? 0 : elapsed);
        } else {
          phase = (playing ? readLfoPhase(module.id,elapsed) : undefined) ?? readPatchLfoPhase(module.settings,elapsed);
        }
        const x = String(140 * phase);
        line.setAttribute('x1',x);
        line.setAttribute('x2',x);
        if (trace && playing) {
          const sample = readControlValue(module.id);
          if (sample === undefined) continue;
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
            const sourceModule = modules.get(cable.source.moduleId);
            const destinationModule = modules.get(cable.destination.moduleId);
            if (!sourceModule || !destinationModule) return null;
            const input = getPatchPorts(destinationModule).find(port => port.id === cable.destination.portId);
            return <PatchCableView key={cable.id} cable={cable} sourceModule={sourceModule}
              destinationModule={destinationModule} destinationPort={input}
              sourcePosition={from} destinationPosition={to} selected={cable === selectedCable}
              onSelect={() => onSelect({kind:'cable',id:cable.id})}/>;
          })}
        </svg>
        {patch.modules.map(module => {
          const position = positions[module.id];
          if (!position) return null;
          return <PatchNode key={module.id} patch={patch} module={module} position={position}
            selected={selection?.kind === 'module' && selection.id === module.id}
            pending={pending} selectedControlCable={controlCable}
            connectedControlSource={connectedControlSources.has(module.id)}
            canConnect={canConnect} onPort={onPort} onCableChange={onCableChange}
            onSelect={() => onSelect({kind:'module',id:module.id})}
            onDragStart={event => beginDrag(event,module.id,position)}
            onDragMove={moveDrag} onDragEnd={finishDrag}
            registerControlBadge={(moduleId,badge) => {
              if (badge) controlBadges.current.set(moduleId,badge);
              else controlBadges.current.delete(moduleId);
            }}
            preview={<PatchNodePreview module={module} playing={playing}
              inputConnected={connectedInputs.has(module.id)} outputLevel={outputLevel}
              getWaveformAnalyser={getWaveformAnalyser}/>}/>
        })}
      </div>
    </div>
  </div>;
}
