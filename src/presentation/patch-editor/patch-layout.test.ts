import { describe, expect, it } from 'vitest';
import { MAXIMUM_NODE_POSITION, PATCH_CANVAS_MINIMUM } from '../../domain/patch';
import { boundNodePosition, findVisibleNodePosition, getEdgeScrollSpeed, getPatchScrollOffset, getZoomedCanvasOrigin } from './patch-layout';

const size = {width:174,height:104};

describe('new patch node placement', () => {
  it('centers a node using the visible area in scrolled canvas coordinates', () => {
    const view = {x:680,y:420,width:440,height:360};
    expect(findVisibleNodePosition(view,size,[])).toEqual({x:813,y:548});
  });

  it('centers new nodes in an area left and above the original canvas', () => {
    const view = {x:-520,y:-290,width:440,height:360};
    expect(findVisibleNodePosition(view,size,[])).toEqual({x:-387,y:-162});
  });

  it('bounds node movement symmetrically in both axes', () => {
    const limit = MAXIMUM_NODE_POSITION;
    expect(boundNodePosition({x:-limit-1,y:limit+1})).toEqual({x:-limit,y:limit});
    expect(boundNodePosition({x:limit+1,y:-limit-1})).toEqual({x:limit,y:-limit});
  });

  it('chooses the nearest clear position inside the visible area', () => {
    const view = {x:200,y:80,width:600,height:490};
    const obstacle = {x:413,y:273,...size};
    const result = findVisibleNodePosition(view,size,[obstacle]);
    expect(Math.abs(result.y - obstacle.y)).toBe(116);
    expect(result.x).toBe(obstacle.x);
  });

  it('keeps the new node in view when there is no room to avoid overlap', () => {
    const view = {x:18,y:30,width:230,height:160};
    expect(findVisibleNodePosition(view,size,[view])).toEqual({x:46,y:58});
  });
});

describe('patch viewport zoom', () => {
  it('keeps the world point beneath the anchor fixed when zooming from a scrolled view', () => {
    const scroll = {x:220,y:160};
    const anchor = {x:300,y:180};
    expect(getZoomedCanvasOrigin(scroll,anchor,1,2)).toEqual({x:370,y:250});
  });

  it('preserves negative viewport positions when zooming or restoring a preset', () => {
    const origin = getZoomedCanvasOrigin({x:-40,y:-30},{x:300,y:180},1,0.5);
    expect(origin).toEqual({x:-340,y:-210});
    expect(getPatchScrollOffset(origin,0.5)).toEqual({
      x:(-340-PATCH_CANVAS_MINIMUM)/2,y:(-210-PATCH_CANVAS_MINIMUM)/2
    });
  });

  it('clamps the viewport at the left and top edges when zooming out', () => {
    const origin = {x:PATCH_CANVAS_MINIMUM+10,y:PATCH_CANVAS_MINIMUM+20};
    expect(getZoomedCanvasOrigin(origin,{x:300,y:180},1,0.5)).toEqual({
      x:PATCH_CANVAS_MINIMUM,y:PATCH_CANVAS_MINIMUM
    });
  });
});

describe('drag edge scrolling', () => {
  it('scrolls in either direction near an edge and stays still in the middle', () => {
    expect(getEdgeScrollSpeed(106,100,320)).toBeLessThan(0);
    expect(getEdgeScrollSpeed(260,100,320)).toBe(0);
    expect(getEdgeScrollSpeed(414,100,320)).toBeGreaterThan(0);
    expect(getEdgeScrollSpeed(90,100,320)).toBe(-getEdgeScrollSpeed(430,100,320));
  });
});
