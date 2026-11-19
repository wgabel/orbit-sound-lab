import { describe, expect, it } from 'vitest';
import { findVisibleNodePosition, getZoomedCanvasOrigin } from './patch-layout';

const size = {width:174,height:104};

describe('new patch node placement', () => {
  it('centers a node using the visible area in scrolled canvas coordinates', () => {
    const view = {x:680,y:420,width:440,height:360};
    expect(findVisibleNodePosition(view,size,[])).toEqual({x:813,y:548});
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

  it('clamps the pending viewport to the origin if zooming out past the canvas edge', () => {
    expect(getZoomedCanvasOrigin({x:40,y:30},{x:300,y:180},1,0.5)).toEqual({x:0,y:0});
  });
});
