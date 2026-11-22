import type { Box, Point } from './geometry.ts';

export type DistanceField = (x: number, y: number) => number;

interface Crossing {
  edge: number;
  at: Point;
}

type Segment = [Crossing, Crossing];

interface Grid {
  field: DistanceField;
  box: Box;
  size: number;
  cols: number;
  rows: number;
  values: Float64Array;
  segments: Segment[];
}

const MAX_CELLS = 250000;
const BLOCK = 6;

function createGrid(field: DistanceField, box: Box, cell: number): Grid {
  const size = Math.max(cell, Math.sqrt((box.w * box.h) / MAX_CELLS));
  const cols = Math.ceil(box.w / size) + 1;
  const rows = Math.ceil(box.h / size) + 1;

  return {
    field,
    box,
    size,
    cols,
    rows,
    values: new Float64Array((cols + 1) * (rows + 1)).fill(Number.NaN),
    segments: [],
  };
}

function sample(grid: Grid, [i, j]: Point): number {
  return grid.field(grid.box.x + i * grid.size, grid.box.y + j * grid.size);
}

function valueAt(grid: Grid, i: number, j: number): number {
  const k = j * (grid.cols + 1) + i;
  const cached = grid.values[k] ?? Number.NaN;

  if (!Number.isNaN(cached)) return cached;

  // An exact zero would sit on both sides of the edge, so nudge it outside.
  const raw = sample(grid, [i, j]);
  const v = raw === 0 ? 1e-9 : raw;

  grid.values[k] = v;

  return v;
}

function horizontalEdge(grid: Grid, i: number, j: number): number {
  return (j * (grid.cols + 1) + i) * 2;
}

function verticalEdge(grid: Grid, i: number, j: number): number {
  return (j * (grid.cols + 1) + i) * 2 + 1;
}

function worldPoint(grid: Grid, [i, j]: Point): Point {
  return [grid.box.x + i * grid.size, grid.box.y + j * grid.size];
}

function crossing(grid: Grid, from: Point, to: Point, edge: number): Crossing {
  const a = valueAt(grid, from[0], from[1]);
  const b = valueAt(grid, to[0], to[1]);
  const t = a / (a - b);
  const [ax, ay] = worldPoint(grid, from);
  const [bx, by] = worldPoint(grid, to);

  return { edge, at: [ax + (bx - ax) * t, ay + (by - ay) * t] };
}

function caseOf(grid: Grid, i: number, j: number): number {
  const tl = valueAt(grid, i, j) < 0 ? 8 : 0;
  const tr = valueAt(grid, i + 1, j) < 0 ? 4 : 0;
  const br = valueAt(grid, i + 1, j + 1) < 0 ? 2 : 0;
  const bl = valueAt(grid, i, j + 1) < 0 ? 1 : 0;

  return tl | tr | br | bl;
}

function cellSegments(grid: Grid, i: number, j: number, index: number): Segment[] {
  const top = (): Crossing => crossing(grid, [i, j], [i + 1, j], horizontalEdge(grid, i, j));
  const right = (): Crossing =>
    crossing(grid, [i + 1, j], [i + 1, j + 1], verticalEdge(grid, i + 1, j));
  const bottom = (): Crossing =>
    crossing(grid, [i, j + 1], [i + 1, j + 1], horizontalEdge(grid, i, j + 1));
  const left = (): Crossing => crossing(grid, [i, j], [i, j + 1], verticalEdge(grid, i, j));
  const centerInside = (): boolean => sample(grid, [i + 0.5, j + 0.5]) < 0;

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
      if (centerInside()) {
        return [
          [left(), top()],
          [bottom(), right()],
        ];
      }

      return [
        [left(), bottom()],
        [top(), right()],
      ];
    case 10:
      if (centerInside()) {
        return [
          [top(), right()],
          [left(), bottom()],
        ];
      }

      return [
        [left(), top()],
        [bottom(), right()],
      ];
    default:
      return [];
  }
}

function traceCell(grid: Grid, i: number, j: number): void {
  const index = caseOf(grid, i, j);

  if (index === 0 || index === 15) return;

  for (const segment of cellSegments(grid, i, j, index)) grid.segments.push(segment);
}

function traceBlock(grid: Grid, [bi, bj]: Point, reach: number): void {
  const center = sample(grid, [bi + BLOCK / 2, bj + BLOCK / 2]);

  // A block whose center is far from the edge cannot contain any of it.
  if (Math.abs(center) > reach) return;

  const lastCol = Math.min(grid.cols, bi + BLOCK);
  const lastRow = Math.min(grid.rows, bj + BLOCK);

  for (let j = bj; j < lastRow; j++) {
    for (let i = bi; i < lastCol; i++) traceCell(grid, i, j);
  }
}

function nextUnused(
  byEdge: Map<number, Segment[]>,
  used: Set<Segment>,
  edge: number,
): Segment | undefined {
  return byEdge.get(edge)?.find((s) => !used.has(s));
}

function stitch(segments: Segment[]): Point[][] {
  const byEdge = new Map<number, Segment[]>();

  for (const segment of segments) {
    for (const end of segment) {
      const list = byEdge.get(end.edge);

      if (list) {
        list.push(segment);
      } else {
        byEdge.set(end.edge, [segment]);
      }
    }
  }

  const used = new Set<Segment>();
  const loops: Point[][] = [];

  for (const first of segments) {
    if (used.has(first)) continue;

    used.add(first);

    const loop: Point[] = [first[0].at, first[1].at];
    let tail = first[1].edge;

    for (let guard = 0; guard < segments.length; guard++) {
      const next = nextUnused(byEdge, used, tail);

      if (!next) break;

      used.add(next);

      const far = next[0].edge === tail ? next[1] : next[0];

      loop.push(far.at);
      tail = far.edge;
    }

    if (loop.length > 3) loops.push(loop);
  }

  return loops;
}

export function traceContours(field: DistanceField, box: Box, cell: number): Point[][] {
  const grid = createGrid(field, box, cell);
  const reach = BLOCK * grid.size * Math.SQRT1_2 + grid.size;

  for (let bj = 0; bj < grid.rows; bj += BLOCK) {
    for (let bi = 0; bi < grid.cols; bi += BLOCK) traceBlock(grid, [bi, bj], reach);
  }

  return stitch(grid.segments);
}
