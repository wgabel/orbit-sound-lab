import { getPatchPorts, MAXIMUM_NODE_POSITION, MINIMUM_NODE_POSITION, PATCH_CANVAS_MINIMUM } from '@domain/patch';
import type { NodePosition, PatchModule } from '@domain/patch';

export interface Size {readonly width: number; readonly height: number}
export interface Rectangle extends NodePosition, Size {}

export const PATCH_NODE_WIDTH = 174;
export const PATCH_NODE_TITLE_HEIGHT = 40;
export const PATCH_PORT_HEIGHT = 32;
const NODE_GAP = 12;
export const PATCH_CANVAS_WIDTH = MAXIMUM_NODE_POSITION + PATCH_NODE_WIDTH + 160 - PATCH_CANVAS_MINIMUM;
export const PATCH_CANVAS_HEIGHT = MAXIMUM_NODE_POSITION + 240 - PATCH_CANVAS_MINIMUM;

export function boundNodePosition(point: NodePosition): NodePosition {
  return {
    x:Math.min(MAXIMUM_NODE_POSITION, Math.max(MINIMUM_NODE_POSITION,point.x)),
    y:Math.min(MAXIMUM_NODE_POSITION, Math.max(MINIMUM_NODE_POSITION,point.y))
  };
}

function getNewNodeSize(module: PatchModule): Size {
  const ports = getPatchPorts(module);
  const inputCount = ports.filter(port => port.direction === 'input').length;
  const rows = Math.max(inputCount, ports.length - inputCount);
  const bodyHeight = Math.max(36, rows * PATCH_PORT_HEIGHT);
  const previewHeight = module.kind === 'oscilloscope' ? 89 :
    (module.kind === 'automation' || module.kind === 'lfo' || module.kind === 'simplexNoise') ? 49 : module.kind === 'output' ? 24 : 0;
  return {width:PATCH_NODE_WIDTH, height:PATCH_NODE_TITLE_HEIGHT + bodyHeight + previewHeight};
}

export function findVisibleNodePosition(view: Rectangle, size: Size, obstacles: readonly Rectangle[]): NodePosition {
  const center = boundNodePosition({
    x:Math.round(view.x + (view.width - size.width) / 2),
    y:Math.round(view.y + (view.height - size.height) / 2)
  });
  const left = Math.max(MINIMUM_NODE_POSITION,view.x);
  const top = Math.max(MINIMUM_NODE_POSITION,view.y);
  const right = Math.min(MAXIMUM_NODE_POSITION,view.x + view.width - size.width);
  const bottom = Math.min(MAXIMUM_NODE_POSITION,view.y + view.height - size.height);
  return findNearestFreeNodePosition(center,size,obstacles,{left,top,right,bottom}) ?? center;
}

export function nodesOverlap(first: Rectangle, second: Rectangle, gap = 0): boolean {
  return first.x < second.x + second.width + gap && first.x > second.x - first.width - gap &&
    first.y < second.y + second.height + gap && first.y > second.y - first.height - gap;
}

export function findNearestFreeNodePosition(origin: NodePosition, size: Size, obstacles: readonly Rectangle[],
  bounds: {left: number; top: number; right: number; bottom: number}): NodePosition | undefined {
  const {left,top,right,bottom} = bounds;
  const columns = new Set([origin.x, left, right]);
  const rows = new Set([origin.y, top, bottom]);
  for (const obstacle of obstacles) {
    columns.add(obstacle.x - size.width - NODE_GAP);
    columns.add(obstacle.x + obstacle.width + NODE_GAP);
    rows.add(obstacle.y - size.height - NODE_GAP);
    rows.add(obstacle.y + obstacle.height + NODE_GAP);
  }

  let nearest: NodePosition | undefined;
  let distance = Infinity;
  for (const x of columns) {
    if (x < left || x > right) continue;
    for (const y of rows) {
      if (y < top || y > bottom) continue;
      const candidateDistance = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      if (candidateDistance >= distance) continue;
      const candidate = {...size,x,y};
      if (obstacles.some(obstacle => nodesOverlap(candidate,obstacle,NODE_GAP))) continue;
      nearest = {x,y};
      distance = candidateDistance;
    }
  }
  return nearest;
}

export function getVisiblePatchViewport(viewport: HTMLDivElement): Rectangle {
  const rect = viewport.getBoundingClientRect();
  const left = rect.left + viewport.clientLeft;
  const top = rect.top + viewport.clientTop;
  // The page can clip the scrolling canvas itself, especially on a phone.
  const visibleLeft = Math.max(0,left);
  const visibleTop = Math.max(0,top);
  const visibleRight = Math.min(window.innerWidth,left + viewport.clientWidth);
  const visibleBottom = Math.min(window.innerHeight,top + viewport.clientHeight);
  return {
    x:visibleLeft-left,y:visibleTop-top,
    width:Math.max(0,visibleRight-visibleLeft),height:Math.max(0,visibleBottom-visibleTop)
  };
}

export function readPatchViewportOrigin(viewport: HTMLDivElement, scale: number): NodePosition {
  return {x:PATCH_CANVAS_MINIMUM + viewport.scrollLeft/scale,y:PATCH_CANVAS_MINIMUM + viewport.scrollTop/scale};
}

export function getPatchScrollOffset(origin: NodePosition, scale: number): NodePosition {
  return {x:(origin.x-PATCH_CANVAS_MINIMUM)*scale,y:(origin.y-PATCH_CANVAS_MINIMUM)*scale};
}

export function getZoomedCanvasOrigin(origin: NodePosition, anchor: NodePosition, scale: number, nextScale: number): NodePosition {
  return {
    x:Math.max(PATCH_CANVAS_MINIMUM,origin.x + anchor.x/scale - anchor.x/nextScale),
    y:Math.max(PATCH_CANVAS_MINIMUM,origin.y + anchor.y/scale - anchor.y/nextScale)
  };
}

export function getEdgeScrollSpeed(position: number, start: number, size: number): number {
  if (size <= 0) return 0;
  const edge = Math.min(48,size/2);
  const fromStart = position - start;
  const fromEnd = start + size - position;
  if (fromStart < edge) return -900 * (1 - Math.max(0,fromStart)/edge);
  if (fromEnd < edge) return 900 * (1 - Math.max(0,fromEnd)/edge);
  return 0;
}

export function placeNewPatchNode(viewport: HTMLDivElement, module: PatchModule, scale = 1): NodePosition {
  const visible = getVisiblePatchViewport(viewport);
  const origin = readPatchViewportOrigin(viewport,scale);
  const view = {
    x:origin.x + visible.x/scale,y:origin.y + visible.y/scale,
    width:visible.width/scale,height:visible.height/scale
  };
  const obstacles = Array.from(viewport.querySelectorAll<HTMLElement>('.patch-node'), node =>
    ({x:PATCH_CANVAS_MINIMUM + node.offsetLeft,y:PATCH_CANVAS_MINIMUM + node.offsetTop,width:node.offsetWidth,height:node.offsetHeight}));
  return findVisibleNodePosition(view,getNewNodeSize(module),obstacles);
}
