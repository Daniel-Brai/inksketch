export type Point = readonly [number, number];
export type Size = readonly [number, number];
export type Box = { x: number; y: number; w: number; h: number };

const ORIGIN: Point = [0, 0];

export const pointAt = (points: readonly Point[], i: number): Point => points[i] ?? ORIGIN;
export const numberAt = (values: readonly number[], i: number): number => values[i] ?? 0;

export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const rad = (deg: number): number => (deg * Math.PI) / 180;

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

export function normalize(v: Point): Point {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

export function normal(a: Point, b: Point): Point {
  const d = normalize(sub(b, a));
  return [-d[1], d[0]];
}

export function rotate(p: Point, deg: number, around: Point = [0, 0]): Point {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const x = p[0] - around[0];
  const y = p[1] - around[1];

  return [around[0] + x * c - y * s, around[1] + x * s + y * c];
}

export function polylineLength(points: readonly Point[], closed = false): number {
  let total = 0;

  for (let i = 1; i < points.length; i++) total += dist(pointAt(points, i - 1), pointAt(points, i));

  if (closed && points.length > 2) {
    total += dist(pointAt(points, points.length - 1), pointAt(points, 0));
  }

  return total;
}

export function ellipsePoints(
  center: Point,
  radii: Size,
  degrees: readonly [number, number] = [0, 360],
  step?: number,
): Point[] {
  const [rx, ry] = radii;
  const sweep = degrees[1] - degrees[0];
  const arcLength = Math.PI * (rx + ry) * (Math.abs(sweep) / 360);
  const byLength = Math.ceil(arcLength / 6);
  const n = Math.max(8, step ? Math.ceil(Math.abs(sweep) / step) : byLength);
  const out: Point[] = [];

  for (let i = 0; i <= n; i++) {
    const a = rad(degrees[0] + (sweep * i) / n);
    out.push([center[0] + Math.cos(a) * rx, center[1] + Math.sin(a) * ry]);
  }

  return out;
}

export function bbox(points: readonly Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function polygonArea(poly: readonly Point[]): number {
  let a = 0;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pj = pointAt(poly, j);
    const pi = pointAt(poly, i);

    a += (pj[0] + pi[0]) * (pj[1] - pi[1]);
  }

  return Math.abs(a / 2);
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = pointAt(poly, i);
    const [xj, yj] = pointAt(poly, j);
    const crosses = yi > p[1] !== yj > p[1];

    if (crosses && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}

function crossingsAt(poly: readonly Point[], y: number): number[] {
  const xs: number[] = [];

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = pointAt(poly, j);
    const [x2, y2] = pointAt(poly, i);

    if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }

  return xs.sort((a, b) => a - b);
}

export function hatchSegments(
  poly: readonly Point[],
  angle: number,
  gap: number,
): Array<[Point, Point]> {
  if (poly.length < 3 || gap <= 0) return [];

  const box = bbox(poly);
  const center: Point = [box.x + box.w / 2, box.y + box.h / 2];
  const flat = poly.map((p) => rotate(p, -angle, center));
  const fb = bbox(flat);
  const segments: Array<[Point, Point]> = [];

  for (let y = fb.y + gap / 2; y < fb.y + fb.h; y += gap) {
    const xs = crossingsAt(flat, y);

    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = numberAt(xs, k);
      const to = numberAt(xs, k + 1);
      if (to - from < 0.5) continue;

      segments.push([rotate([from, y], angle, center), rotate([to, y], angle, center)]);
    }
  }

  return segments;
}

export function f(n: number, digits = 2): string {
  const k = 10 ** digits;
  const r = Math.round(n * k) / k;

  return Object.is(r, -0) ? '0' : String(r);
}

function wrapIndex(points: readonly Point[], closed: boolean): (i: number) => Point {
  const n = points.length;

  return (i) => {
    if (closed) return pointAt(points, (i + n) % n);

    return pointAt(points, Math.max(0, Math.min(n - 1, i)));
  };
}

function compactNumber(n: number): string {
  const text = f(n, 1);

  if (text.startsWith('0.')) return text.slice(1);

  if (text.startsWith('-0.')) return `-${text.slice(2)}`;

  return text;
}

function compactList(values: number[]): string {
  let out = compactNumber(numberAt(values, 0));

  for (let i = 1; i < values.length; i++) {
    const next = compactNumber(numberAt(values, i));
    out += next.startsWith('-') ? next : ` ${next}`;
  }

  return out;
}

const roundToTenth = (p: Point): Point => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

type Segment = readonly [Point, Point, Point, Point];

function smoothSegments(points: readonly Point[], closed: boolean): Segment[] {
  const get = wrapIndex(points, closed);
  const last = closed ? points.length : points.length - 1;
  const out: Segment[] = [];

  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];

    out.push([p1, c1, c2, p2]);
  }

  return out;
}

export function pathData(points: readonly Point[], smooth = true, closed = false): string {
  if (points.length === 0) return 'M0 0';

  let cur = roundToTenth(pointAt(points, 0));
  const parts = [`M${compactList([cur[0], cur[1]])}`];

  const delta = (p: Point): number[] => {
    const q = roundToTenth(p);
    return [q[0] - cur[0], q[1] - cur[1]];
  };

  if (points.length === 1) return `${parts[0]}h0`;

  if (!smooth || points.length < 3) {
    for (let i = 1; i < points.length; i++) {
      parts.push(`l${compactList(delta(pointAt(points, i)))}`);
      cur = roundToTenth(pointAt(points, i));
    }

    if (closed) parts.push('z');

    return parts.join('');
  }

  smoothSegments(points, closed).forEach(([, c1, c2, p2], i) => {
    const tail = [...delta(c2), ...delta(p2)];

    parts.push(i === 0 ? `c${compactList([...delta(c1), ...tail])}` : `s${compactList(tail)}`);
    cur = roundToTenth(p2);
  });

  if (closed) parts.push('z');

  return parts.join('');
}

const roundToPixel = (p: Point): Point => [Math.round(p[0]), Math.round(p[1])];

export function dotsPath(points: readonly Point[]): string {
  let cur = roundToPixel(pointAt(points, 0));
  const parts = [`M${compactList([cur[0], cur[1]])}h0`];

  for (let i = 1; i < points.length; i++) {
    const q = roundToPixel(pointAt(points, i));

    parts.push(`m${compactList([q[0] - cur[0], q[1] - cur[1]])}h0`);
    cur = q;
  }

  return parts.join('');
}

export function taperedOutline(
  path: readonly Point[],
  widths: readonly [number, number],
): { outline: Point[]; left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  const last = Math.max(1, path.length - 1);

  path.forEach((p, i) => {
    const dir = normalize(
      sub(path[Math.min(path.length - 1, i + 1)] ?? p, path[Math.max(0, i - 1)] ?? p),
    );

    const half = (widths[0] + (widths[1] - widths[0]) * (i / last)) / 2;

    left.push([p[0] - dir[1] * half, p[1] + dir[0] * half]);
    right.push([p[0] + dir[1] * half, p[1] - dir[0] * half]);
  });

  return { outline: [...left, ...right.toReversed()], left, right };
}

export function bentLine(a: Point, b: Point, bend: number, segments = 24): Point[] {
  if (!bend) return [a, b];

  const c = add(lerp(a, b, 0.5), mul(normal(a, b), dist(a, b) * bend));
  const out: Point[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;

    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }

  return out;
}

function bezierAt(seg: Segment, t: number): Point {
  const [p0, p1, p2, p3] = seg;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

export function spline(points: readonly Point[], closed = false, perSegment = 10): Point[] {
  if (points.length < 3) return [...points];

  const out: Point[] = [];

  for (const seg of smoothSegments(points, closed)) {
    for (let k = 0; k < perSegment; k++) out.push(bezierAt(seg, k / perSegment));
  }

  if (!closed) out.push(pointAt(points, points.length - 1));

  return out;
}

export function cubicPoints(seg: Segment, count: number): Point[] {
  const out: Point[] = [];

  for (let i = 1; i <= count; i++) out.push(bezierAt(seg, i / count));

  return out;
}

interface PathIndex {
  points: readonly Point[];
  cumulative: number[];
  total: number;
}

export function indexPath(points: readonly Point[]): PathIndex {
  const cumulative = [0];

  for (let i = 1; i < points.length; i++) {
    cumulative.push(numberAt(cumulative, i - 1) + dist(pointAt(points, i - 1), pointAt(points, i)));
  }

  return { points, cumulative, total: cumulative.at(-1) ?? 0 };
}

export function sampleAt(index: PathIndex, target: number): { p: Point; dir: Point } {
  const { points, cumulative } = index;
  let lo = 1;
  let hi = points.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;

    if (numberAt(cumulative, mid) < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const a = pointAt(points, lo - 1);
  const b = pointAt(points, lo);
  const before = numberAt(cumulative, lo - 1);
  const span = numberAt(cumulative, lo) - before || 1;
  const t = clamp((target - before) / span);

  return { p: lerp(a, b, t), dir: normalize(sub(b, a)) };
}

export function resampleCount(points: readonly Point[], count: number, closed = false): Point[] {
  const index = indexPath(closed ? [...points, pointAt(points, 0)] : points);
  const steps = closed ? count : count - 1;
  const out: Point[] = [];

  for (let i = 0; i < count; i++) out.push(sampleAt(index, (index.total * i) / steps).p);

  return out;
}
