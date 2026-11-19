import { getPatchPorts } from '../../domain/patch';
import type { PatchModule } from '../../domain/patch';

export interface NodePosition {readonly x: number; readonly y: number}
export type PatchLayout = Readonly<Record<string, NodePosition>>;

interface Size {readonly width: number; readonly height: number}
interface Rectangle extends NodePosition, Size {}

export const PATCH_NODE_WIDTH = 174;
export const PATCH_NODE_TITLE_HEIGHT = 40;
export const PATCH_PORT_HEIGHT = 32;
const NODE_GAP = 12;
const MINIMUM_NODE_X = 16;
const MINIMUM_NODE_Y = 12;
const MAXIMUM_NODE_POSITION = 2400;

export function boundNodePosition(point: NodePosition): NodePosition {
  return {
    x:Math.min(MAXIMUM_NODE_POSITION, Math.max(MINIMUM_NODE_X,point.x)),
    y:Math.min(MAXIMUM_NODE_POSITION, Math.max(MINIMUM_NODE_Y,point.y))
  };
}

function getNewNodeSize(module: PatchModule): Size {
  const ports = getPatchPorts(module);
  const inputCount = ports.filter(port => port.direction === 'input').length;
  const rows = Math.max(inputCount, ports.length - inputCount);
  const bodyHeight = Math.max(36, rows * PATCH_PORT_HEIGHT);
  const previewHeight = module.kind === 'automation' ? 49 : module.kind === 'output' ? 24 : 0;
  return {width:PATCH_NODE_WIDTH, height:PATCH_NODE_TITLE_HEIGHT + bodyHeight + previewHeight};
}

export function findVisibleNodePosition(view: Rectangle, size: Size, obstacles: readonly Rectangle[]): NodePosition {
  const center = boundNodePosition({
    x:Math.round(view.x + (view.width - size.width) / 2),
    y:Math.round(view.y + (view.height - size.height) / 2)
  });
  const left = Math.max(MINIMUM_NODE_X,view.x);
  const top = Math.max(MINIMUM_NODE_Y,view.y);
  const right = Math.min(MAXIMUM_NODE_POSITION,view.x + view.width - size.width);
  const bottom = Math.min(MAXIMUM_NODE_POSITION,view.y + view.height - size.height);
  const columns = new Set([center.x, left, right]);
  const rows = new Set([center.y, top, bottom]);
  for (const obstacle of obstacles) {
    columns.add(obstacle.x - size.width - NODE_GAP);
    columns.add(obstacle.x + obstacle.width + NODE_GAP);
    rows.add(obstacle.y - size.height - NODE_GAP);
    rows.add(obstacle.y + obstacle.height + NODE_GAP);
  }

  let nearest = center;
  let distance = Infinity;
  for (const x of columns) {
    if (x < left || x > right) continue;
    for (const y of rows) {
      if (y < top || y > bottom) continue;
      const candidateDistance = (x - center.x) ** 2 + (y - center.y) ** 2;
      if (candidateDistance >= distance || obstacles.some(obstacle =>
        x < obstacle.x + obstacle.width + NODE_GAP && x + size.width + NODE_GAP > obstacle.x &&
        y < obstacle.y + obstacle.height + NODE_GAP && y + size.height + NODE_GAP > obstacle.y)) continue;
      nearest = {x,y};
      distance = candidateDistance;
    }
  }
  return nearest;
}

export function placeNewPatchNode(viewport: HTMLDivElement, module: PatchModule): NodePosition {
  const rect = viewport.getBoundingClientRect();
  const left = rect.left + viewport.clientLeft;
  const top = rect.top + viewport.clientTop;
  // The page can clip the scrolling canvas itself, especially on a phone.
  const visibleLeft = Math.max(0,left);
  const visibleTop = Math.max(0,top);
  const visibleRight = Math.min(window.innerWidth,left + viewport.clientWidth);
  const visibleBottom = Math.min(window.innerHeight,top + viewport.clientHeight);
  const view = {
    x:viewport.scrollLeft + visibleLeft - left,
    y:viewport.scrollTop + visibleTop - top,
    width:Math.max(0,visibleRight - visibleLeft),
    height:Math.max(0,visibleBottom - visibleTop)
  };
  const obstacles = Array.from(viewport.querySelectorAll<HTMLElement>('.patch-node'), node =>
    ({x:node.offsetLeft,y:node.offsetTop,width:node.offsetWidth,height:node.offsetHeight}));
  return findVisibleNodePosition(view,getNewNodeSize(module),obstacles);
}
