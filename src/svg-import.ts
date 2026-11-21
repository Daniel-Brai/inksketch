import { numberAt, type Box, type Point } from './geometry.ts';
import { readNumbers } from './scan.ts';
import { parsePath, type Subpath } from './svgpath.ts';
import { scanTags, type Tag } from './xml.ts';

export interface TracedShape {
  subpaths: Subpath[];
  filled: boolean;
  stroked: boolean;
}

type Matrix = readonly [number, number, number, number, number, number];

interface Paint {
  m: Matrix;
  fill?: string | undefined;
  stroke?: string | undefined;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const ROOT_PAINT: Paint = { m: IDENTITY };
const MAX_SHAPES = 5000;
const CONTAINERS = new Set(['g', 'a', 'svg', 'switch']);

const HIDDEN = new Set([
  'defs',
  'clipPath',
  'mask',
  'symbol',
  'style',
  'title',
  'desc',
  'metadata',
  'pattern',
  'marker',
  'linearGradient',
  'radialGradient',
  'filter',
]);

const num = (value: string | undefined, fallback = 0): number =>
  value === undefined ? fallback : Number.parseFloat(value);

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function rotation(v: number[]): Matrix {
  const [degrees = 0, cx, cy] = v;
  const a = (degrees * Math.PI) / 180;
  const r: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];

  if (cx === undefined || cy === undefined) return r;

  return multiply(multiply([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
}

function matrixFrom(v: number[]): Matrix {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = v;

  if (v.length !== 6) return IDENTITY;

  return [a, b, c, d, e, f];
}

function transformCall(name: string, v: number[]): Matrix {
  switch (name) {
    case 'matrix':
      return matrixFrom(v);
    case 'translate':
      return [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    case 'scale':
      return [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    case 'rotate':
      return rotation(v);
    case 'skewX':
      return [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    case 'skewY':
      return [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    default:
      return IDENTITY;
  }
}

function parseTransform(value: string | undefined): Matrix {
  if (!value) return IDENTITY;

  let m = IDENTITY;
  let i = 0;

  while (i < value.length) {
    const open = value.indexOf('(', i);

    if (open < 0) break;

    const close = value.indexOf(')', open);
    const name = value.slice(i, open).replaceAll(',', ' ').trim();
    const args = value.slice(open + 1, close < 0 ? value.length : close);

    m = multiply(m, transformCall(name, readNumbers(args)));
    i = close < 0 ? value.length : close + 1;
  }

  return m;
}

const apply = (m: Matrix, p: Point): Point => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];

function withStyle(attrs: Record<string, string>): Record<string, string> {
  const style = attrs.style;

  if (!style) return attrs;

  const out = { ...attrs };

  for (const decl of style.split(';')) {
    const at = decl.indexOf(':');
    if (at > 0) out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
  }

  return out;
}

function rectPath(a: Record<string, string>, tolerance: number): Subpath[] {
  const x = num(a.x);
  const y = num(a.y);
  const w = num(a.width);
  const h = num(a.height);
  const rx = Math.min(num(a.rx, num(a.ry)), w / 2);
  const ry = Math.min(num(a.ry, rx), h / 2);

  if (rx <= 0) {
    return [
      {
        points: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ],
        closed: true,
      },
    ];
  }

  const corner = `A${rx} ${ry} 0 0 1`;

  const d = [
    `M${x + rx} ${y}`,
    `H${x + w - rx}`,
    `${corner} ${x + w} ${y + ry}`,
    `V${y + h - ry}`,
    `${corner} ${x + w - rx} ${y + h}`,
    `H${x + rx}`,
    `${corner} ${x} ${y + h - ry}`,
    `V${y + ry}`,
    `${corner} ${x + rx} ${y}`,
    'Z',
  ].join('');

  return parsePath(d, tolerance);
}

function ellipsePath(a: Record<string, string>, isCircle: boolean, tolerance: number): Subpath[] {
  const cx = num(a.cx);
  const cy = num(a.cy);
  const rx = isCircle ? num(a.r) : num(a.rx);
  const ry = isCircle ? num(a.r) : num(a.ry);

  return parsePath(
    `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`,
    tolerance,
  );
}

function polyPath(a: Record<string, string>, closed: boolean): Subpath[] {
  const v = readNumbers(a.points);
  const points: Point[] = [];

  for (let k = 0; k + 1 < v.length; k += 2) points.push([numberAt(v, k), numberAt(v, k + 1)]);

  return [{ points, closed }];
}

function elementPath(name: string, a: Record<string, string>, tolerance: number): Subpath[] {
  switch (name) {
    case 'path':
      return a.d ? parsePath(a.d, tolerance) : [];
    case 'rect':
      return rectPath(a, tolerance);
    case 'circle':
      return ellipsePath(a, true, tolerance);
    case 'ellipse':
      return ellipsePath(a, false, tolerance);
    case 'line':
      return [
        {
          points: [
            [num(a.x1), num(a.y1)],
            [num(a.x2), num(a.y2)],
          ],
          closed: false,
        },
      ];
    case 'polyline':
      return polyPath(a, false);
    case 'polygon':
      return polyPath(a, true);
    default:
      return [];
  }
}

function readViewBox(root: Tag | undefined): Box {
  const vb = readNumbers(root?.attrs.viewBox);

  const [x = 0, y = 0, w = 0, h = 0] = vb;

  if (vb.length === 4) return { x, y, w, h };

  return { x: 0, y: 0, w: num(root?.attrs.width, 100), h: num(root?.attrs.height, 100) };
}

function isFilled(name: string, fill: string | undefined): boolean {
  if (name === 'line' || name === 'polyline') return false;

  return fill !== 'none' && fill !== 'transparent';
}

function isStroked(paint: Paint, filled: boolean): boolean {
  if (!filled) return true;

  return paint.stroke !== undefined && paint.stroke !== 'none';
}

export function readSVG(svg: string, tolerance = 3): { shapes: TracedShape[]; viewBox: Box } {
  const tags = scanTags(svg);
  const root = tags.find((t) => t.name === 'svg' && !t.closing);
  const stack: Paint[] = [ROOT_PAINT];
  const shapes: TracedShape[] = [];
  let hiddenDepth = 0;

  for (const tag of tags) {
    if (hiddenDepth > 0) {
      if (!tag.selfClosing) hiddenDepth += tag.closing ? -1 : 1;
      continue;
    }

    if (HIDDEN.has(tag.name) && !tag.closing) {
      if (!tag.selfClosing) hiddenDepth = 1;
      continue;
    }

    if (tag.closing) {
      if (CONTAINERS.has(tag.name) && stack.length > 1) stack.pop();
      continue;
    }

    const a = withStyle(tag.attrs);
    const parent = stack.at(-1) ?? ROOT_PAINT;

    const paint: Paint = {
      m: multiply(parent.m, parseTransform(a.transform)),
      fill: a.fill ?? parent.fill,
      stroke: a.stroke ?? parent.stroke,
    };

    if (CONTAINERS.has(tag.name)) {
      if (!tag.selfClosing) stack.push(paint);
      continue;
    }

    const subs = elementPath(tag.name, a, tolerance);

    if (!subs.length || shapes.length >= MAX_SHAPES) continue;

    const filled = isFilled(tag.name, paint.fill);

    shapes.push({
      subpaths: subs.map((sub) => ({
        closed: sub.closed,
        points: sub.points.map((p) => apply(paint.m, p)),
      })),
      filled,
      stroked: isStroked(paint, filled),
    });
  }

  return { shapes, viewBox: readViewBox(root) };
}
