import type { FillSpec } from '#/fills.ts';
import { add, lerp, mul, pointAt, pointInPolygon, rad, type Box, type Point } from '#/geometry.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import { scaledRoughness, scaledWidth } from './helpers.ts';
import type { CracksOptions, GrassOptions, LogEndOptions, PebblesOptions } from './types.ts';

const MAX_PEBBLES = 1500;
const MAX_CELLS = 600;
const MAX_BLADES = 3000;

function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function shadeOf(shade: PebblesOptions['shade'], r: number): FillSpec | undefined {
  if (shade !== 'stipple') return undefined;

  return { type: 'stipple', density: 7, from: 45 + (r % 5) * 10, strength: 0.9 };
}

function packCircles(
  area: Box,
  o: { count: number; minR: number; maxR: number; seed: string },
  s: Sketch,
): Array<{ c: Point; r: number }> {
  const rng = s.random(o.seed);
  const cell = o.maxR * 2;
  const grid = new Map<string, Array<{ c: Point; r: number }>>();
  const placed: Array<{ c: Point; r: number }> = [];

  for (let tries = 0; tries < o.count * 40 && placed.length < o.count; tries++) {
    const fade = tries / (o.count * 40);
    const r = rng.range(o.minR, o.maxR - (o.maxR - o.minR) * fade);
    const c: Point = [area.x + rng.next() * area.w, area.y + rng.next() * area.h];
    const gx = Math.floor(c[0] / cell);
    const gy = Math.floor(c[1] / cell);
    let free = true;

    for (let dx = -1; dx <= 1 && free; dx++) {
      for (let dy = -1; dy <= 1 && free; dy++) {
        for (const other of grid.get(cellKey(gx + dx, gy + dy)) ?? []) {
          if (Math.hypot(other.c[0] - c[0], other.c[1] - c[1]) < other.r + r - 0.5) free = false;
        }
      }
    }

    if (!free) continue;

    const entry = { c, r };

    placed.push(entry);

    const bucket = grid.get(cellKey(gx, gy));

    if (bucket) {
      bucket.push(entry);
    } else {
      grid.set(cellKey(gx, gy), [entry]);
    }
  }

  return placed;
}

export function pebbles(s: Sketch, area: Box, o: PebblesOptions = {}): Shape {
  const { minR = 5, maxR = 16, shade = 'stipple', ...ink } = o;
  const average = (minR + maxR) / 2;
  const fill = Math.round((area.w * area.h) / (Math.PI * average * average * 1.15));
  const count = Math.min(MAX_PEBBLES, o.count ?? fill);
  const stones = packCircles(area, { count, minR, maxR, seed: `pebbles:${area.x}:${area.y}` }, s);

  return s
    .group(() => {
      for (const { c, r } of stones) {
        s.stone(c, r, {
          ...ink,
          shade,
          squash: 0.8 + (r % 3) * 0.06,
          width: scaledWidth(s, ink, 0.75),
          fill: shadeOf(shade, r),
        });
      }
    })
    .gap(8);
}

function splitConvex(poly: Point[], through: Point, angleDeg: number): [Point[], Point[]] {
  const d: Point = [Math.cos(rad(angleDeg)), Math.sin(rad(angleDeg))];
  const side = (p: Point): number => d[0] * (p[1] - through[1]) - d[1] * (p[0] - through[0]);
  const a: Point[] = [];
  const b: Point[] = [];

  for (let i = 0; i < poly.length; i++) {
    const p = pointAt(poly, i);
    const q = pointAt(poly, (i + 1) % poly.length);
    const sp = side(p);
    const sq = side(q);

    if (sp >= 0) {
      a.push(p);
    } else {
      b.push(p);
    }

    if (sp >= 0 !== sq >= 0) {
      const cut = lerp(p, q, sp / (sp - sq));

      a.push(cut);
      b.push(cut);
    }
  }

  return [a, b];
}

function centroid(poly: Point[]): Point {
  const sum = poly.reduce<Point>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / poly.length, sum[1] / poly.length];
}

function shrink(poly: Point[], by: number): Point[] {
  const c = centroid(poly);
  return poly.map((p) => {
    const d = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1;
    return lerp(p, c, Math.min(0.45, by / d));
  });
}

function voronoiCells(area: Box, seeds: Point[]): Point[][] {
  const frame: Point[] = [
    [area.x, area.y],
    [area.x + area.w, area.y],
    [area.x + area.w, area.y + area.h],
    [area.x, area.y + area.h],
  ];

  const near = (Math.max(area.w, area.h) / Math.sqrt(seeds.length)) * 3;

  return seeds.map((seed) => {
    let cell = frame;

    for (const other of seeds) {
      if (other === seed || Math.hypot(other[0] - seed[0], other[1] - seed[1]) > near) continue;

      const mid = lerp(seed, other, 0.5);
      const along = (Math.atan2(other[1] - seed[1], other[0] - seed[0]) * 180) / Math.PI + 90;
      const [left, right] = splitConvex(cell, mid, along);
      const keep = [left, right].find((part) => part.length >= 3 && pointInPolygon(seed, part));

      cell = keep ?? cell;
    }

    return cell;
  });
}

export function cracks(s: Sketch, area: Box, o: CracksOptions = {}): Shape {
  const { cells = Math.round((area.w * area.h) / 1400), gap = 2.2, shadeShare = 0.4, ...ink } = o;
  const rng = s.random(`cracks:${area.x}:${area.y}`);

  const seeds = Array.from({ length: Math.min(MAX_CELLS, cells) }, (): Point => [
    area.x + rng.next() * area.w,
    area.y + rng.next() * area.h,
  ]);

  const plateInk = {
    ...ink,
    width: scaledWidth(s, ink, 0.7),
    roughness: scaledRoughness(s, ink, 1.4),
  };

  return s
    .group(() => {
      for (const cell of voronoiCells(area, seeds)) {
        const plate = shrink(cell, gap + rng.range(0, gap));

        s.curve(plate, { ...plateInk, closed: true });

        if (rng.chance(shadeShare)) {
          s.stipple(plate, { density: 4, from: 'edge', strength: 0.85 }, ink);
        }
      }
    })
    .gap(6);
}

export function grass(s: Sketch, from: Point, to: Point, o: GrassOptions = {}): Shape {
  const { density = 1.2, height = 24, leanDeg = 8, ...ink } = o;
  const rng = s.random(`grass:${from[0]}:${from[1]}`);
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const blades = Math.min(MAX_BLADES, Math.round((length / 10) * density * 10));
  const thin = { ...ink, width: scaledWidth(s, ink, 0.55), overshoot: 0 };

  return s
    .group(() => {
      for (let i = 0; i < blades; i++) {
        const base = lerp(from, to, rng.next());
        const h = height * rng.range(0.4, 1.1);
        const lean = rad(leanDeg + rng.gauss() * 14);
        const tip = add(base, [Math.sin(lean) * h, -Math.cos(lean) * h]);

        const mid = add(
          lerp(base, tip, 0.55),
          mul([Math.cos(lean), Math.sin(lean)], rng.gauss() * h * 0.08),
        );

        s.stroke([base, mid, tip], false, thin, true);
      }
    })
    .gap(3);
}

export function logEnd(s: Sketch, center: Point, r: number, o: LogEndOptions = {}): Shape {
  const { rings = Math.max(3, Math.round(r / 5)), splits = 2, ...ink } = o;
  const rng = s.random(`log:${center[0]}:${center[1]}`);
  const ringInk = { ...ink, width: scaledWidth(s, ink, 0.5) };

  return s.group(() => {
    s.blob(center, [r, r * 0.92], { ...ink, irregularity: 0.08, fill: 'paper' });

    for (let i = 1; i < rings; i++) {
      const k = (i / rings) * 0.92;

      s.blob(
        [center[0] + rng.gauss() * r * 0.02, center[1] + rng.gauss() * r * 0.02],
        [r * k, r * k * 0.92],
        { ...ringInk, irregularity: 0.05 },
      );
    }

    for (let i = 0; i < splits; i++) {
      const a = rad(rng.range(0, 360));
      const v: Point = [Math.cos(a), Math.sin(a)];

      s.line(add(center, mul(v, r * rng.range(0.1, 0.3))), add(center, mul(v, r * 0.95)), ringInk);
    }
  });
}
