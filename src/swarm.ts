import { add, bbox, dist, f, lerp, mul, normal, type Box, type Point } from './geometry.ts';
import { MAX_SWARM } from './limits.ts';
import type { Motion } from './model.ts';
import { motion, motions } from './motion.ts';
import type { Rng } from './random.ts';
import type { Shape } from './shape.ts';
import type { Sketch } from './sketch.ts';
import type { SwarmMotion, SwarmOptions, SwarmShape } from './swarm.types.ts';

interface Crowd {
  area: Box;
  center: Point;
  rng: Rng;
  speed: number;
}

function place(shape: SwarmShape, rng: Rng): Point {
  switch (shape.type) {
    case 'ring': {
      const a = rng.next() * Math.PI * 2;
      const r = shape.r + rng.gauss() * (shape.width ?? shape.r * 0.12) * 0.5;
      return [shape.center[0] + Math.cos(a) * r, shape.center[1] + Math.sin(a) * r];
    }
    case 'disk': {
      const a = rng.next() * Math.PI * 2;
      const r = shape.r * Math.pow(rng.next(), (shape.falloff ?? 1) / 2);
      return [shape.center[0] + Math.cos(a) * r, shape.center[1] + Math.sin(a) * r];
    }
    case 'rect':
      return [shape.at[0] + rng.next() * shape.size[0], shape.at[1] + rng.next() * shape.size[1]];
    case 'line':
      return add(
        lerp(shape.from, shape.to, rng.next()),
        mul(normal(shape.from, shape.to), rng.gauss() * (shape.spread ?? 10)),
      );
    case 'points': {
      const p = rng.pick(shape.points);
      const spread = shape.spread ?? 12;
      return [p[0] + rng.gauss() * spread, p[1] + rng.gauss() * spread];
    }
  }
}

function areaOf(shape: SwarmShape): Box {
  switch (shape.type) {
    case 'rect':
      return { x: shape.at[0], y: shape.at[1], w: shape.size[0], h: shape.size[1] };
    case 'points':
      return bbox(shape.points);
    case 'line':
      return bbox([shape.from, shape.to]);
    default:
      return {
        x: shape.center[0] - shape.r,
        y: shape.center[1] - shape.r,
        w: shape.r * 2,
        h: shape.r * 2,
      };
  }
}

function figurePath(p: Point, h: number, rng: Rng): string {
  const [x, y] = p;
  const hip = y - h * 0.38;
  const shoulder = y - h * 0.66;
  const lean = rng.range(-0.06, 0.06) * h;
  const hands = rng.chance(0.2) ? shoulder - h * 0.28 : shoulder + h * 0.3;

  return [
    `M${f(x + lean)} ${f(shoulder)}L${f(x)} ${f(hip)}`,
    `M${f(x - h * 0.13)} ${f(y)}L${f(x)} ${f(hip)}L${f(x + h * 0.13)} ${f(y)}`,
    `M${f(x - h * 0.16)} ${f(hands)}L${f(x + lean)} ${f(shoulder)}L${f(x + h * 0.16)} ${f(hands)}`,
  ].join('');
}

const GROUP_MOTIONS: Record<Exclude<SwarmMotion, 'none'>, (crowd: Crowd) => Motion> = {
  drift: ({ rng, speed }) =>
    motion(
      [
        { offset: 0, x: 0, y: 0 },
        { offset: 1, x: rng.range(-6, 6), y: rng.range(-6, 6) },
      ],
      {
        duration: rng.range(2200, 5000) / speed,
        direction: 'alternate',
        delay: -rng.range(0, 3000),
      },
    ),
  orbit: ({ rng, speed, center, area }) =>
    motions.spin({
      duration: (rng.range(25000, 70000) * ((dist(center, [area.x, area.y]) || 1) / 200)) / speed,
      origin: center,
      direction: rng.chance(0.5) ? 'normal' : 'reverse',
    }),
  breathe: ({ rng, speed, center }) =>
    motion(
      [
        { offset: 0, scale: 1 },
        { offset: 1, scale: rng.range(1.02, 1.07) },
      ],
      {
        duration: rng.range(2500, 4500) / speed,
        direction: 'alternate',
        origin: center,
        delay: -rng.range(0, 3000),
      },
    ),
  shimmer: ({ rng, speed }) =>
    motions.blink({
      duration: rng.range(1500, 4000) / speed,
      min: 0.35,
      delay: -rng.range(0, 3000),
    }),
};

export function swarm(s: Sketch, o: SwarmOptions): Shape {
  const rng = s.random(`swarm:${o.seed ?? o.count}`);
  const kind = o.kind ?? 'dot';
  const base = o.size ?? (kind === 'dot' ? 3 : 12);
  const jitter = o.sizeJitter ?? 0.4;
  const groups = Math.max(1, Math.min(24, o.groups ?? 6));
  const count = Math.max(0, Math.min(MAX_SWARM, Math.round(o.count)));
  const color = s.color(o.color);
  const area = areaOf(o.shape);

  const crowd: Crowd = {
    area,
    center: [area.x + area.w / 2, area.y + area.h / 2],
    rng,
    speed: o.speed ?? 1,
  };

  const points = Array.from({ length: count }, () => place(o.shape, rng)).sort(
    (a, b) => a[1] - b[1],
  );

  const buckets: Point[][] = Array.from({ length: groups }, () => []);

  for (const p of points) buckets[rng.int(0, groups - 1)]?.push(p);

  const sizeAt = (p: Point): number => {
    const hasDepth = o.perspective && area.h > 0;
    const depth = hasDepth ? 0.35 + 0.65 * ((p[1] - area.y) / area.h) : 1;

    return Math.max(0.6, base * depth * (1 + rng.range(-jitter, jitter)));
  };

  const shape = s
    .group(() => {
      for (const bucket of buckets) {
        if (!bucket.length) continue;

        const dots = new Map<number, string[]>();
        const lines: string[] = [];

        for (const p of bucket) {
          const size = sizeAt(p);
          const asFigure = kind === 'figure' || (kind === 'mix' && rng.chance(0.5));
          const dotSize = asFigure ? Math.round(size * 0.26 * 2) / 2 : Math.round(size * 2) / 2;
          const dotAt: Point = asFigure ? [p[0], p[1] - size * 0.86] : p;
          const list = dots.get(dotSize) ?? [];

          list.push(`M${f(dotAt[0])} ${f(dotAt[1])}h0`);
          dots.set(dotSize, list);

          if (asFigure) lines.push(figurePath(p, size, rng));
        }

        const svg: string[] = [];
        const stroke = `stroke="${color}"`;

        if (lines.length) {
          svg.push(
            `<path d="${lines.join('')}" ${stroke} stroke-width="${f(Math.max(0.6, base * 0.07))}"/>`,
          );
        }

        for (const [size, d] of dots) {
          svg.push(`<path d="${d.join('')}" ${stroke} stroke-width="${f(size)}"/>`);
        }

        const b = bbox(bucket);
        const group = s.raw(svg.join(''), { x: b.x, y: b.y - base, w: b.w, h: b.h + base });
        const kindOfMotion = o.motion ?? 'drift';

        if (kindOfMotion !== 'none') group.animate(GROUP_MOTIONS[kindOfMotion](crowd));
      }
    })
    .instant();

  if (o.opacity !== undefined) shape.opacity(o.opacity);

  if (o.appearAtMs !== undefined) shape.fadeIn({ delay: o.appearAtMs, duration: 1200 });

  return shape;
}
