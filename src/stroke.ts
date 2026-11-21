import {
  add,
  dist,
  lerp,
  mul,
  normalize,
  numberAt,
  pointAt,
  polylineLength,
  sub,
  type Point,
} from './geometry.ts';
import { lineNoise, type Rng } from './random.ts';

export interface StrokeFeel {
  roughness: number;
  bowing: number;
  overshoot: number;
}

interface Sample {
  p: Point;
  s: number;
  seg: number;
  t: number;
  segLen: number;
}

function samples(points: readonly Point[], step: number): Sample[] {
  const out: Sample[] = [];
  let s = 0;

  for (let i = 1; i < points.length; i++) {
    const a = pointAt(points, i - 1);
    const b = pointAt(points, i);
    const len = dist(a, b);
    const n = Math.max(1, Math.ceil(len / step));

    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      out.push({ p: lerp(a, b, t), s: s + len * t, seg: i - 1, t, segLen: len });
    }

    s += len;
  }

  return out;
}

function closeWithTail(input: readonly Point[], extra: number): Point[] {
  const points = [...input, pointAt(input, 0)];
  let left = extra;

  for (let i = 1; i < input.length && left > 0; i++) {
    const a = pointAt(input, i - 1);
    const b = pointAt(input, i);
    const l = dist(a, b);

    if (l >= left) {
      points.push(lerp(a, b, left / l));
      return points;
    }

    points.push(b);
    left -= l;
  }

  return points;
}

function extendEnds(input: readonly Point[], overshoot: number, rng: Rng): Point[] {
  const points = [...input];
  const n = points.length;
  const first = pointAt(points, 0);
  const last = pointAt(points, n - 1);
  const head = normalize(sub(first, pointAt(points, 1)));
  const tail = normalize(sub(last, pointAt(points, n - 2)));

  points[0] = add(first, mul(head, overshoot * rng.range(0.1, 1)));
  points[n - 1] = add(last, mul(tail, overshoot * rng.range(0.2, 1)));

  return points;
}

function shapePoints(
  input: readonly Point[],
  closed: boolean,
  feel: StrokeFeel,
  rng: Rng,
): Point[] {
  const wobbly = feel.roughness > 0 && feel.overshoot > 0;

  if (closed && wobbly) return closeWithTail(input, feel.overshoot * rng.range(1.5, 3.5));

  if (closed) return [...input, pointAt(input, 0)];

  if (wobbly) return extendEnds(input, feel.overshoot, rng);

  return [...input];
}

function thin(points: readonly Point[], spacing: number): Point[] {
  let last = pointAt(points, 0);
  const kept: Point[] = [last];

  for (let i = 1; i < points.length - 1; i++) {
    const p = pointAt(points, i);

    if (dist(last, p) >= spacing) {
      kept.push(p);
      last = p;
    }
  }

  kept.push(pointAt(points, points.length - 1));

  return kept;
}

export function handLine(
  input: readonly Point[],
  closed: boolean,
  feel: StrokeFeel,
  rng: Rng,
): Point[] {
  if (input.length < 2) return [...input];

  const points = shapePoints(input, closed, feel, rng);

  if (feel.roughness <= 0) return points;

  const baseStep = Math.max(6, Math.min(12, 12 - feel.roughness * 2));
  const step = Math.max(1.5, Math.min(baseStep, polylineLength(points) / 16));
  const list = samples(thin(points, step * 0.6), step);
  const drift = lineNoise(rng, 60 + rng.range(0, 40));
  const wobble = lineNoise(rng, 28);
  const amp = feel.roughness * 1.4;
  const bowSigns = points.map(() => rng.sign() * rng.range(0.4, 1));
  const total = list.at(-1)?.s || 1;
  const spiral = closed ? rng.sign() * feel.roughness * rng.range(0.8, 2) : 0;

  return list.map((sample, i) => {
    const prev = (list[Math.max(0, i - 1)] ?? sample).p;
    const next = (list[Math.min(list.length - 1, i + 1)] ?? sample).p;
    const dir = normalize(sub(next, prev));
    const nrm: Point = [-dir[1], dir[0]];
    const reach = Math.min(sample.segLen, 400);

    const bow =
      Math.sin(Math.PI * sample.t) *
      reach *
      feel.bowing *
      0.01 *
      feel.roughness *
      numberAt(bowSigns, sample.seg);

    const off =
      drift(sample.s) * amp + wobble(sample.s) * amp * 0.25 + bow + (sample.s / total) * spiral;

    return add(sample.p, mul(nrm, off));
  });
}
