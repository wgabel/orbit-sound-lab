import { MAXIMUM_NODE_POSITION } from '@domain/patch';
import type { PatchLayout } from '@domain/patch';
import { boundNodePosition, findNearestFreeNodePosition, nodesOverlap } from './patch-layout';
import type { Rectangle, Size } from './patch-layout';

const minimum = boundNodePosition({x:-MAXIMUM_NODE_POSITION,y:-MAXIMUM_NODE_POSITION});
const bounds = {left:minimum.x,top:minimum.y,right:MAXIMUM_NODE_POSITION,bottom:MAXIMUM_NODE_POSITION};

export function resolvePatchOverlaps(positions: PatchLayout, sizes: ReadonlyMap<string, Size>): PatchLayout {
  const obstacles: Rectangle[] = [];
  const overlapping: {id: string; rectangle: Rectangle}[] = [];

  // Reserve all positions that can stay before finding room for the displaced nodes.
  for (const [id,position] of Object.entries(positions)) {
    const size = sizes.get(id);
    if (!size) continue;
    const rectangle = {...position,...size};
    if (obstacles.some(obstacle => nodesOverlap(rectangle,obstacle))) overlapping.push({id,rectangle});
    else obstacles.push(rectangle);
  }

  if (!overlapping.length) return positions;
  const next = {...positions};
  for (const {id,rectangle} of overlapping) {
    const position = findNearestFreeNodePosition(rectangle,rectangle,obstacles,bounds);
    if (position) next[id] = position;
    obstacles.push({...rectangle,...position});
  }
  return next;
}
