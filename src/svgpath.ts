import { cubicPoints, dist, pointAt, type Point } from './geometry.ts';
import { atEnd, peekNumber, readFlag, readNumber, skipSeparators, type Cursor } from './scan.ts';

export interface Subpath {
  points: Point[];
  closed: boolean;
}

interface ArcSpec {
  from: Point;
  to: Point;
  radii: Point;
  rotationDeg: number;
  large: boolean;
  sweep: boolean;
}

const MAX_SEGMENT_STEPS = 200;

function cubic(controls: readonly [Point, Point, Point, Point], tolerance: number): Point[] {
  const [p0, p1, p2, p3] = controls;
  const len = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);

  return cubicPoints(
    controls,
    Math.max(2, Math.min(MAX_SEGMENT_STEPS, Math.ceil(len / tolerance))),
  );
}

function quad(controls: readonly [Point, Point, Point], tolerance: number): Point[] {
  const [p0, p1, p2] = controls;
  const c1: Point = [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])];
  const c2: Point = [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])];

  return cubic([p0, c1, c2, p2], tolerance);
}

function vectorAngle(u: Point, v: Point): number {
  return Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
}

function directedSweep(raw: number, clockwise: boolean): number {
  if (!clockwise && raw > 0) return raw - 2 * Math.PI;

  if (clockwise && raw < 0) return raw + 2 * Math.PI;

  return raw;
}

function arcCenter(spec: ArcSpec): { center: Point; radii: Point; start: number; sweep: number } {
  const { from, to } = spec;
  const phi = (spec.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / spec.radii[0] ** 2 + (y1 * y1) / spec.radii[1] ** 2;
  const grow = lambda > 1 ? Math.sqrt(lambda) : 1;
  const rx = Math.abs(spec.radii[0]) * grow;
  const ry = Math.abs(spec.radii[1]) * grow;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (spec.large === spec.sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const startVec: Point = [(x1 - cx1) / rx, (y1 - cy1) / ry];
  const endVec: Point = [(-x1 - cx1) / rx, (-y1 - cy1) / ry];
  const raw = vectorAngle(startVec, endVec);
  const sweep = directedSweep(raw, spec.sweep);

  return {
    center: [
      cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2,
      sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2,
    ],
    radii: [rx, ry],
    start: vectorAngle([1, 0], startVec),
    sweep,
  };
}

function arc(spec: ArcSpec, tolerance: number): Point[] {
  if (spec.radii[0] === 0 || spec.radii[1] === 0) return [spec.to];

  const { center, radii, start, sweep } = arcCenter(spec);
  const phi = (spec.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  const n = Math.max(
    4,
    Math.min(MAX_SEGMENT_STEPS, Math.ceil((Math.abs(sweep) * Math.max(...radii)) / tolerance)),
  );

  const out: Point[] = [];

  for (let i = 1; i <= n; i++) {
    const t = start + (sweep * i) / n;
    const ex = radii[0] * Math.cos(t);
    const ey = radii[1] * Math.sin(t);

    out.push([cos * ex - sin * ey + center[0], sin * ex + cos * ey + center[1]]);
  }

  return out;
}

function reflect(pos: Point, ctrl: Point | null, allowed: boolean): Point {
  if (!ctrl || !allowed) return pos;

  return [2 * pos[0] - ctrl[0], 2 * pos[1] - ctrl[1]];
}

const COMMANDS = new Set('MmLlHhVvCcSsQqTtAaZz');

function nextCommand(c: Cursor, previous: string | null): string {
  skipSeparators(c);

  const ch = c.text[c.i];

  if (ch !== undefined && COMMANDS.has(ch)) {
    c.i++;
    return ch;
  }

  if (previous === null || previous === 'Z' || previous === 'z' || !peekNumber(c)) {
    throw new Error(`inksketch: bad path data at character ${c.i}`);
  }

  if (previous === 'M') return 'L';

  if (previous === 'm') return 'l';

  return previous;
}

function closeLast(subs: Subpath[]): void {
  const last = subs.at(-1);

  if (last) last.closed = true;
}

function followsCurve(previous: string | null, commands: string): boolean {
  if (previous === null) return false;

  return commands.includes(previous);
}

function must(value: number | null, c: Cursor): number {
  if (value === null) {
    throw new Error(`inksketch: expected a number in path data at character ${c.i}`);
  }

  return value;
}

export function parsePath(d: string, tolerance = 4): Subpath[] {
  const c: Cursor = { text: d, i: 0 };
  const subs: Subpath[] = [];
  let open = false;
  let pos: Point = [0, 0];
  let start: Point = [0, 0];
  let ctrl: Point | null = null;
  let cmd: string | null = null;
  let prevCmd: string | null = null;

  const num = (): number => must(readNumber(c), c);

  const flag = (): boolean => must(readFlag(c), c) === 1;

  const begin = (p: Point): void => {
    subs.push({ points: [p], closed: false });
    open = true;
  };

  const lineTo = (pts: Point[]): void => {
    if (!open) begin(pos);
    subs.at(-1)?.points.push(...pts);
  };

  while (!atEnd(c)) {
    cmd = nextCommand(c, cmd);

    const rel = cmd === cmd.toLowerCase();
    const point = (): Point => (rel ? [pos[0] + num(), pos[1] + num()] : [num(), num()]);

    switch (cmd.toUpperCase()) {
      case 'M':
        pos = point();
        start = pos;
        begin(pos);
        ctrl = null;
        break;
      case 'L':
        pos = point();
        lineTo([pos]);
        ctrl = null;
        break;
      case 'H':
        pos = [num() + (rel ? pos[0] : 0), pos[1]];
        lineTo([pos]);
        ctrl = null;
        break;
      case 'V':
        pos = [pos[0], num() + (rel ? pos[1] : 0)];
        lineTo([pos]);
        ctrl = null;
        break;
      case 'C': {
        const c1 = point();
        const c2 = point();
        const end = point();
        lineTo(cubic([pos, c1, c2, end], tolerance));
        ctrl = c2;
        pos = end;
        break;
      }
      case 'S': {
        const c1 = reflect(pos, ctrl, followsCurve(prevCmd, 'CcSs'));
        const c2 = point();
        const end = point();
        lineTo(cubic([pos, c1, c2, end], tolerance));
        ctrl = c2;
        pos = end;
        break;
      }
      case 'Q': {
        const q = point();
        const end = point();
        lineTo(quad([pos, q, end], tolerance));
        ctrl = q;
        pos = end;
        break;
      }
      case 'T': {
        const q = reflect(pos, ctrl, followsCurve(prevCmd, 'QqTt'));
        const end = point();
        lineTo(quad([pos, q, end], tolerance));
        ctrl = q;
        pos = end;
        break;
      }
      case 'A': {
        const radii: Point = [num(), num()];
        const rotationDeg = num();
        const large = flag();
        const sweep = flag();
        const end = point();
        lineTo(arc({ from: pos, to: end, radii, rotationDeg, large, sweep }, tolerance));
        pos = end;
        ctrl = null;
        break;
      }
      case 'Z':
        if (open) closeLast(subs);
        open = false;
        pos = start;
        ctrl = null;
        break;
    }

    prevCmd = cmd;
  }

  for (const sub of subs) {
    const p = sub.points;
    if (sub.closed && p.length > 2 && dist(pointAt(p, 0), pointAt(p, p.length - 1)) < 0.01) p.pop();
  }

  return subs.filter((sub) => sub.points.length > 1);
}
