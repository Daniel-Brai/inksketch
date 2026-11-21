import type { Box, Point } from './geometry.ts';

export type DistanceField = (x: number, y: number) => number;

type Edge = string;

interface Crossing {
  key: Edge;
  at: Point;
}

const MAX_CELLS = 250000;

interface Corner {
  v: number;
  p: Point;
}

type Corners = readonly [Corner, Corner, Corner, Corner];

function crossing(a: Corner, b: Corner, key: Edge): Crossing {
  const t = a.v / (a.v - b.v);
  return { key, at: [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t] };
}

function cellSegments(
  corners: Corners,
  keys: [Edge, Edge, Edge, Edge],
  center: () => number,
): Array<[Crossing, Crossing]> {
  const [tl, tr, br, bl] = corners;
  const top = (): Crossing => crossing(tl, tr, keys[0]);
  const right = (): Crossing => crossing(tr, br, keys[1]);
  const bottom = (): Crossing => crossing(bl, br, keys[2]);
  const left = (): Crossing => crossing(tl, bl, keys[3]);
  const index = (tl.v < 0 ? 8 : 0) | (tr.v < 0 ? 4 : 0) | (br.v < 0 ? 2 : 0) | (bl.v < 0 ? 1 : 0);

  switch (index) {
    case 1:
    case 14:
      return [[left(), bottom()]];
    case 2:
    case 13:
      return [[bottom(), right()]];
    case 3:
    case 12:
      return [[left(), right()]];
    case 4:
    case 11:
      return [[top(), right()]];
    case 6:
    case 9:
      return [[top(), bottom()]];
    case 7:
    case 8:
      return [[left(), top()]];
    case 5:
      return center() < 0
        ? [
            [left(), top()],
            [bottom(), right()],
          ]
        : [
            [left(), bottom()],
            [top(), right()],
          ];
    case 10:
      return center() < 0
        ? [
            [top(), right()],
            [left(), bottom()],
          ]
        : [
            [left(), top()],
            [bottom(), right()],
          ];
    default:
      return [];
  }
}

function stitch(segments: Array<[Crossing, Crossing]>): Point[][] {
  const byKey = new Map<Edge, Array<[Crossing, Crossing]>>();

  for (const seg of segments) {
    for (const end of seg) {
      const list = byKey.get(end.key);

      if (list) {
        list.push(seg);
      } else {
        byKey.set(end.key, [seg]);
      }
    }
  }

  const used = new Set<[Crossing, Crossing]>();
  const loops: Point[][] = [];

  for (const first of segments) {
    if (used.has(first)) continue;

    used.add(first);

    const loop: Point[] = [first[0].at, first[1].at];
    let tail = first[1].key;

    for (let guard = 0; guard < segments.length; guard++) {
      const next = (byKey.get(tail) ?? []).find((s) => !used.has(s));

      if (!next) break;

      used.add(next);

      const forward = next[0].key === tail;
      const far = forward ? next[1] : next[0];

      loop.push(far.at);
      tail = far.key;
    }

    if (loop.length > 3) loops.push(loop);
  }

  return loops;
}

const BLOCK = 6;

export function traceContours(field: DistanceField, box: Box, cell: number): Point[][] {
  const size = Math.max(cell, Math.sqrt((box.w * box.h) / MAX_CELLS));
  const cols = Math.ceil(box.w / size) + 1;
  const rows = Math.ceil(box.h / size) + 1;
  const values = new Float64Array((cols + 1) * (rows + 1)).fill(Number.NaN);
  const blockReach = BLOCK * size * Math.SQRT1_2 + size;
  const segments: Array<[Crossing, Crossing]> = [];

  const valueAt = (i: number, j: number): number => {
    const k = j * (cols + 1) + i;
    const cached = values[k] ?? Number.NaN;

    if (!Number.isNaN(cached)) return cached;

    const v = field(box.x + i * size, box.y + j * size);
    const safe = v === 0 ? 1e-9 : v;

    values[k] = safe;

    return safe;
  };

  const corner = (i: number, j: number): Corner => ({
    v: valueAt(i, j),
    p: [box.x + i * size, box.y + j * size],
  });

  for (let bj = 0; bj < rows; bj += BLOCK) {
    for (let bi = 0; bi < cols; bi += BLOCK) {
      const center = field(box.x + (bi + BLOCK / 2) * size, box.y + (bj + BLOCK / 2) * size);

      if (Math.abs(center) > blockReach) continue;

      for (let j = bj; j < Math.min(rows, bj + BLOCK); j++) {
        for (let i = bi; i < Math.min(cols, bi + BLOCK); i++) {
          const corners: Corners = [
            corner(i, j),
            corner(i + 1, j),
            corner(i + 1, j + 1),
            corner(i, j + 1),
          ];

          const inside = corners.filter((c) => c.v < 0).length;

          if (inside === 0 || inside === 4) continue;

          const keys: [Edge, Edge, Edge, Edge] = [
            `h${i},${j}`,
            `v${i + 1},${j}`,
            `h${i},${j + 1}`,
            `v${i},${j}`,
          ];

          segments.push(
            ...cellSegments(corners, keys, () =>
              field(box.x + (i + 0.5) * size, box.y + (j + 0.5) * size),
            ),
          );
        }
      }
    }
  }

  return stitch(segments);
}
