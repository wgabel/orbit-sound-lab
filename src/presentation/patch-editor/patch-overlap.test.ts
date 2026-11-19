import { describe, expect, it } from 'vitest';
import { nodesOverlap } from './patch-layout';
import { resolvePatchOverlaps } from './patch-overlap';

const card = {width:174,height:76};

describe('patch overlap cleanup', () => {
  it('preserves the layout when cards touch without overlapping', () => {
    const positions = {first:{x:300,y:300},second:{x:474,y:300}};
    const sizes = new Map([['first',card],['second',card]]);
    expect(resolvePatchOverlaps(positions,sizes)).toBe(positions);
  });

  it('reserves clear cards and moves an overlapping card only to the nearest free position', () => {
    const positions = {anchor:{x:300,y:300},moving:{x:300,y:320},below:{x:300,y:405},far:{x:850,y:600}};
    const sizes = new Map(Object.keys(positions).map(id => [id,card]));
    const next = resolvePatchOverlaps(positions,sizes);
    expect(next).toEqual({...positions,moving:{x:300,y:212}});
    expect(next.below).toBe(positions.below);
    expect(next.far).toBe(positions.far);
    expect(resolvePatchOverlaps(next,sizes)).toBe(next);
  });

  it('uses the actual card heights when unpacking a cluster', () => {
    const positions = {anchor:{x:500,y:500},second:{x:500,y:500},third:{x:500,y:500}};
    const sizes = new Map([['anchor',{...card,height:160}],['second',card],['third',card]]);
    expect(resolvePatchOverlaps(positions,sizes)).toEqual({
      anchor:positions.anchor,second:{x:500,y:412},third:{x:500,y:672}
    });
  });

  it('unpacks the maximum patch size near the original cluster and stays idempotent', () => {
    const entries = Array.from({length:64},(_,index) => ['wave-'+index,{x:1100,y:1100}] as const);
    const sizes = new Map(entries.map(([id]) => [id,card]));
    const next = resolvePatchOverlaps(Object.fromEntries(entries),sizes);
    const rectangles = Object.values(next).map(position => ({...position,...card}));
    expect(rectangles.every((rectangle,index) =>
      rectangles.slice(index+1).every(other => !nodesOverlap(rectangle,other)))).toBe(true);
    expect(Math.max(...rectangles.map(({x,y}) => Math.hypot(x-1100,y-1100)))).toBeLessThan(700);
    expect(resolvePatchOverlaps(next,sizes)).toBe(next);
  });
});
