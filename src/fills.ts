import { bbox, hatchSegments, lerp, pointInPolygon, polygonArea, type Point } from './geometry.ts';
import { MAX_DOTS, MAX_HATCH_LINES, MIN_HATCH_GAP } from './limits.ts';
import type { Rng } from './random.ts';
import type { Color } from './style.ts';
import { tones, type ShadeFrom, type ToneField } from './tone.ts';

export interface SolidFill {
  type: 'solid';
  color?: Color | undefined;
  opacity?: number | undefined;
}

export interface HatchFill {
  type: 'hatch';
  angle?: number | undefined;
  gap?: number | undefined;
  cross?: boolean | number | undefined;
  color?: Color | undefined;
  width?: number | undefined;
  opacity?: number | undefined;
}

export interface StippleFill {
  type: 'stipple';
  density?: number | undefined;
  size?: number | undefined;
  from?: ShadeFrom | undefined;
  strength?: number | undefined;
  color?: Color | undefined;
  opacity?: number | undefined;
}

export interface WashFill {
  type: 'wash';
  color?: Color | undefined;
  opacity?: number | undefined;
  offset?: number | undefined;
}

export type FillSpec =
  | 'none'
  | 'solid'
  | 'paper'
  | 'hatch'
  | 'crosshatch'
  | 'stipple'
  | 'wash'
  | SolidFill
  | HatchFill
  | StippleFill
  | WashFill;

export function normalizeFill(
  fill: FillSpec | undefined,
): SolidFill | HatchFill | StippleFill | WashFill | null {
  switch (fill) {
    case undefined:
    case 'none':
      return null;
    case 'solid':
      return { type: 'solid', color: 'ink' };
    case 'paper':
      return { type: 'solid', color: 'paper' };
    case 'hatch':
      return { type: 'hatch' };
    case 'crosshatch':
      return { type: 'hatch', cross: true };
    case 'stipple':
      return { type: 'stipple' };
    case 'wash':
      return { type: 'wash' };
    default:
      return fill;
  }
}

export type Shade = 'stipple' | 'hatch' | 'crosshatch' | 'solid' | 'none';

export interface ShadeSpec {
  angleDeg?: number | undefined;
  gap?: number | undefined;
  from?: ShadeFrom | undefined;
  strength?: number | undefined;
  density?: number | undefined;
  color?: Color | undefined;
}

export function shadeFill(kind: Shade, spec: ShadeSpec = {}): FillSpec {
  switch (kind) {
    case 'hatch':
    case 'crosshatch':
      return {
        type: 'hatch',
        angle: spec.angleDeg,
        gap: spec.gap,
        cross: kind === 'crosshatch',
        color: spec.color,
      };
    case 'stipple':
      return {
        type: 'stipple',
        density: spec.density,
        from: spec.from,
        strength: spec.strength,
        color: spec.color,
      };
    case 'solid':
      return { type: 'solid', color: spec.color };
    case 'none':
      return 'none';
  }
}

export function hatchSegmentsBounded(
  poly: readonly Point[],
  angle: number,
  gap: number,
): Array<[Point, Point]> {
  return hatchSegments(poly, angle, Math.max(MIN_HATCH_GAP, gap)).slice(0, MAX_HATCH_LINES);
}

export function hatchLines(
  poly: readonly Point[],
  angle: number,
  gap: number,
  rng: Rng,
): Array<[Point, Point]> {
  return hatchSegmentsBounded(poly, angle, gap).map(([a, b]): [Point, Point] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const inset = Math.min(len * 0.25, gap * 0.6);
    const t0 = (rng.range(0.2, 1) * inset) / len;
    const t1 = 1 - (rng.range(0, 1) * inset) / len;

    return [lerp(a, b, t0), lerp(a, b, t1)];
  });
}

export function stipplePoints(
  poly: readonly Point[],
  spec: { density: number; tone: ToneField | null },
  rng: Rng,
): Point[] {
  const box = bbox(poly);

  const target = Math.min(
    MAX_DOTS,
    Math.round((polygonArea(poly) / 100) * Math.max(0, spec.density)),
  );

  const maxAttempts = target * 30 + 200;
  const tone = spec.tone;
  const out: Point[] = [];

  for (let attempts = 0; out.length < target && attempts < maxAttempts; attempts++) {
    const p: Point = [box.x + rng.next() * box.w, box.y + rng.next() * box.h];

    if (!pointInPolygon(p, poly)) continue;

    if (tone === null || rng.next() <= tone(p)) out.push(p);
  }

  return out;
}

export function directionalTone(
  poly: readonly Point[],
  from: ShadeFrom,
  strength: number,
): ToneField {
  const side = tones.side(bbox(poly), from);
  return (p) => {
    const v = side(p);
    return 1 - strength + strength * v * v;
  };
}

export function toneRuns(
  segment: [Point, Point],
  tone: ToneField,
  threshold: number,
): Array<[Point, Point]> {
  const [a, b] = segment;
  const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
  const runs: Array<[Point, Point]> = [];
  let start: Point | null = null;
  let last: Point = a;

  for (let i = 0; i <= steps; i++) {
    const p = lerp(a, b, i / steps);
    const dark = tone(p) >= threshold;

    if (dark && start === null) start = p;

    if (!dark && start !== null) {
      runs.push([start, last]);
      start = null;
    }

    last = p;
  }

  if (start !== null) runs.push([start, b]);

  return runs.filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 2);
}
