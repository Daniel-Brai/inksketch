import { bbox, rotate, type Box, type Point } from './geometry.ts';
import type { StrokeFeel } from './stroke.ts';

export interface DrawControl {
  delay?: number;
  at?: number;
  duration?: number;
  mode?: 'sequence' | 'together';
  instant?: boolean;
  gap?: number;
}

export interface MotionFrame {
  offset: number;
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  easing?: string;
}

export type MotionOrigin = 'center' | 'bottom' | 'top' | Point;

export interface Motion {
  frames: MotionFrame[];
  duration: number;
  delay: number | 'drawn';
  iterations: number | 'infinite';
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  easing: string;
  origin: MotionOrigin;
}

export interface Transform {
  x?: number | undefined;
  y?: number | undefined;
  rotate?: number | undefined;
  scale?: number | undefined;
}

export interface FlipbookFrame {
  index: number;
  count: number;
  fps: number;
  delay: number;
  once: boolean;
}

interface NodeBase {
  id: number;
  opacity?: number | undefined;
}

export interface StrokeNode extends NodeBase {
  kind: 'stroke';
  points: Point[];
  closed: boolean;
  smooth: boolean;
  feel: StrokeFeel;
  width: number;
  color: string;
  dash?: number[] | undefined;
  cap: 'round' | 'butt' | 'square';
  passes: number;
  passOpacity: number;
  pressure: number;
  draw: boolean;
}

export interface FillNode extends NodeBase {
  kind: 'fill';
  points: Point[];
  color: string;
  feel: StrokeFeel;
  draw: boolean;
}

export interface DotsNode extends NodeBase {
  kind: 'dots';
  points: Point[];
  size: number;
  color: string;
  draw: boolean;
}

export interface TextNode extends NodeBase {
  kind: 'text';
  text: string;
  size: number;
  anchor: 'start' | 'middle' | 'end';
  font: string;
  weight: number;
  color: string;
  draw: boolean;
}

export interface RawNode extends NodeBase {
  kind: 'raw';
  svg: string;
  bounds?: Box | undefined;
}

export interface GroupNode extends NodeBase {
  kind: 'group';
  children: SceneNode[];
  transform?: Transform | undefined;
  motions: Motion[];
  draw: DrawControl;
  frame?: FlipbookFrame | undefined;
  blur?: number | undefined;
  window?: { fromMs: number; toMs: number | null } | undefined;
}

export interface UseNode extends NodeBase {
  kind: 'use';
  ref: string;
  bounds: Box;
}

export type SceneNode = StrokeNode | FillNode | DotsNode | TextNode | RawNode | GroupNode | UseNode;

function applyTransform(p: Point, t: Transform | undefined): Point {
  if (!t) return p;

  const s = t.scale ?? 1;
  const turned = rotate([p[0] * s, p[1] * s], t.rotate ?? 0);

  return [turned[0] + (t.x ?? 0), turned[1] + (t.y ?? 0)];
}

function textCorners(node: TextNode): Point[] {
  const w = node.text.length * node.size * 0.62;
  const shift = { start: 0, middle: w / 2, end: w }[node.anchor];

  return [
    [-shift, -node.size],
    [w - shift, 0],
  ];
}

function collect(node: SceneNode, out: Point[]): void {
  switch (node.kind) {
    case 'stroke':
    case 'fill':
    case 'dots':
      out.push(...node.points);
      return;
    case 'text':
      out.push(...textCorners(node));
      return;
    case 'raw':
    case 'use':
      if (node.bounds) {
        out.push(
          [node.bounds.x, node.bounds.y],
          [node.bounds.x + node.bounds.w, node.bounds.y + node.bounds.h],
        );
      }
      return;
    case 'group': {
      const inner: Point[] = [];
      for (const c of node.children) collect(c, inner);
      for (const p of inner) out.push(applyTransform(p, node.transform));
    }
  }
}

export function nodeBounds(node: SceneNode): Box {
  const pts: Point[] = [];

  collect(node, pts);

  return pts.length ? bbox(pts) : { x: 0, y: 0, w: 0, h: 0 };
}
