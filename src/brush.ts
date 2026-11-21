import { indexPath, normalize, numberAt, pointAt, sub, type Point } from './geometry.ts';
import { lineNoise, type Rng } from './random.ts';

function taper(u: number): number {
  const rise = Math.min(1, u / 0.1);
  const fall = Math.min(1, (1 - u) / 0.14);

  return Math.max(0.2, Math.min(rise, fall) ** 0.6);
}

export function brushOutline(
  points: readonly Point[],
  o: { width: number; pressure: number; rng: Rng },
): Point[] {
  const index = indexPath(points);
  const swell = lineNoise(o.rng, 40);
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = pointAt(points, Math.max(0, i - 1));
    const next = pointAt(points, Math.min(points.length - 1, i + 1));
    const dir = normalize(sub(next, prev));
    const along = numberAt(index.cumulative, i);
    const u = index.total ? along / index.total : 0;
    const half = (o.width / 2) * taper(u) * (1 + o.pressure * swell(along) * 0.8);
    const p = pointAt(points, i);

    left.push([p[0] - dir[1] * half, p[1] + dir[0] * half]);
    right.push([p[0] + dir[1] * half, p[1] - dir[0] * half]);
  }

  return [...left, ...right.toReversed()];
}
