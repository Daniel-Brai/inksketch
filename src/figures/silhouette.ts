import type { DistanceField } from '#/contour.ts';
import { bbox, clamp, dist, type Box, type Point } from '#/geometry.ts';

export interface Capsule {
  from: Point;
  to: Point;
  radii: readonly [number, number];
}

export interface Egg {
  center: Point;
  radii: readonly [number, number];
  tiltDeg: number;
}

function capsuleDistance(c: Capsule, x: number, y: number): number {
  const dx = c.to[0] - c.from[0];
  const dy = c.to[1] - c.from[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - c.from[0]) * dx + (y - c.from[1]) * dy) / len2);
  const px = c.from[0] + dx * t;
  const py = c.from[1] + dy * t;

  return Math.hypot(x - px, y - py) - (c.radii[0] + (c.radii[1] - c.radii[0]) * t);
}

interface PreparedEgg {
  cx: number;
  cy: number;
  cos: number;
  sin: number;
  rx: number;
  ry: number;
  scale: number;
}

function prepareEgg(e: Egg): PreparedEgg {
  const a = (-e.tiltDeg * Math.PI) / 180;
  return {
    cx: e.center[0],
    cy: e.center[1],
    cos: Math.cos(a),
    sin: Math.sin(a),
    rx: e.radii[0],
    ry: e.radii[1],
    scale: Math.min(e.radii[0], e.radii[1]),
  };
}

function eggDistance(e: PreparedEgg, x: number, y: number): number {
  const dx = x - e.cx;
  const dy = y - e.cy;
  const lx = (dx * e.cos - dy * e.sin) / e.rx;
  const ly = (dx * e.sin + dy * e.cos) / e.ry;

  return (Math.sqrt(lx * lx + ly * ly) - 1) * e.scale;
}

interface PreparedCapsule {
  capsule: Capsule;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  reach: number;
}

function prepareCapsule(c: Capsule): PreparedCapsule {
  return {
    capsule: c,
    minX: Math.min(c.from[0], c.to[0]),
    minY: Math.min(c.from[1], c.to[1]),
    maxX: Math.max(c.from[0], c.to[0]),
    maxY: Math.max(c.from[1], c.to[1]),
    reach: Math.max(c.radii[0], c.radii[1]),
  };
}

function couldBeCloser(item: PreparedCapsule, x: number, y: number, best: number): boolean {
  const dx = Math.max(item.minX - x, 0, x - item.maxX);
  const dy = Math.max(item.minY - y, 0, y - item.maxY);
  const limit = best + item.reach;

  return limit > 0 && dx * dx + dy * dy < limit * limit;
}

export function bodyField(parts: { capsules: Capsule[]; eggs: Egg[] }): DistanceField {
  const capsules = parts.capsules.map(prepareCapsule);
  const eggs = parts.eggs.map(prepareEgg);

  return (x, y) => {
    let d = Infinity;

    for (const e of eggs) d = Math.min(d, eggDistance(e, x, y));

    for (const item of capsules) {
      if (d !== Infinity && !couldBeCloser(item, x, y, d)) continue;

      d = Math.min(d, capsuleDistance(item.capsule, x, y));
    }

    return d;
  };
}

export function bodyBox(parts: { capsules: Capsule[]; eggs: Egg[] }, pad: number): Box {
  const pts: Point[] = [];

  for (const c of parts.capsules) {
    const r = Math.max(c.radii[0], c.radii[1]);

    pts.push(
      [c.from[0] - r, c.from[1] - r],
      [c.from[0] + r, c.from[1] + r],
      [c.to[0] - r, c.to[1] - r],
      [c.to[0] + r, c.to[1] + r],
    );
  }

  for (const e of parts.eggs) {
    pts.push(
      [e.center[0] - e.radii[1], e.center[1] - e.radii[1]],
      [e.center[0] + e.radii[1], e.center[1] + e.radii[1]],
    );
  }

  const b = bbox(pts);

  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}

export function thinLoop(loop: Point[], spacing: number): Point[] {
  const [first] = loop;

  if (first === undefined) return [];

  const kept: Point[] = [first];
  let last = first;

  for (const p of loop) {
    if (dist(last, p) < spacing) continue;

    kept.push(p);
    last = p;
  }

  return kept;
}
