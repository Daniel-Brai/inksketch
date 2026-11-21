import { ellipsePoints, type Point } from './geometry.ts';
import { GLYPHS, SMALL_CAPS, SPACE, TRACKING, type Glyph } from './glyphs.ts';
import { atEnd, readNumber, type Cursor } from './scan.ts';

export interface GlyphJitter {
  dx: number;
  dy: number;
  rot: number;
}

export interface LetteringOptions {
  size: number;
  anchor?: 'start' | 'middle' | 'end' | undefined;
  lineHeight?: number | undefined;
  slant?: number | undefined;
  tracking?: number | undefined;
  jitter?: ((index: number) => GlyphJitter) | undefined;
}

const cache = new Map<string, Point[][]>();

function glyphNumber(c: Cursor): number {
  const n = readNumber(c);

  if (n === null) throw new Error(`inksketch: bad glyph data at character ${c.i}`);

  return n;
}

function parseGlyph(d: string): Point[][] {
  const hit = cache.get(d);

  if (hit) return hit;

  const c: Cursor = { text: d, i: 0 };
  const strokes: Point[][] = [];
  let current: Point[] | null = null;

  const ensure = (): Point[] => {
    if (current) return current;

    const fresh: Point[] = [];

    strokes.push(fresh);
    current = fresh;

    return fresh;
  };

  while (!atEnd(c)) {
    const cmd = c.text[c.i];

    c.i++;

    if (cmd === '|') {
      current = null;
    } else if (cmd === 'M') {
      current = null;
      ensure().push([glyphNumber(c), glyphNumber(c)]);
    } else if (cmd === 'L') {
      ensure().push([glyphNumber(c), glyphNumber(c)]);
    } else if (cmd === 'C') {
      const center: Point = [glyphNumber(c), glyphNumber(c)];
      const radii: Point = [glyphNumber(c), glyphNumber(c)];
      const range: [number, number] = [glyphNumber(c), glyphNumber(c)];

      ensure().push(...ellipsePoints(center, radii, range, 12));
    } else {
      throw new Error(`inksketch: unknown glyph command "${cmd}"`);
    }
  }

  cache.set(d, strokes);

  return strokes;
}

function glyphFor(ch: string): { glyph: Glyph; scale: number } | null {
  const own = GLYPHS[ch];

  if (own) return { glyph: own, scale: 1 };

  const upper = GLYPHS[ch.toUpperCase()];

  if (!upper) return null;

  return { glyph: upper, scale: SMALL_CAPS };
}

function lineWidth(line: string, opts: LetteringOptions): number {
  const tracking = TRACKING + (opts.tracking ?? 0);
  let w = 0;

  for (const ch of line) {
    const g = ch === ' ' ? null : glyphFor(ch);
    w += g ? g.glyph.w * g.scale + tracking : SPACE;
  }

  return Math.max(0, w - tracking) * (opts.size / 10);
}

export function measureLettering(
  text: string,
  opts: LetteringOptions,
): { width: number; height: number } {
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => lineWidth(l, opts)));
  const lh = (opts.lineHeight ?? 1.6) * opts.size;

  return { width, height: opts.size + (lines.length - 1) * lh };
}

function lineStart(x: number, width: number, anchor: LetteringOptions['anchor']): number {
  if (anchor === 'middle') return x - width / 2;

  if (anchor === 'end') return x - width;

  return x;
}

export function letteringStrokes(text: string, baseline: Point, opts: LetteringOptions): Point[][] {
  const unit = opts.size / 10;
  const tracking = TRACKING + (opts.tracking ?? 0);
  const lh = (opts.lineHeight ?? 1.6) * opts.size;
  const slant = Math.tan(((opts.slant ?? 0) * Math.PI) / 180);
  const still: GlyphJitter = { dx: 0, dy: 0, rot: 0 };
  const out: Point[][] = [];
  let index = 0;

  text.split('\n').forEach((line, li) => {
    let cursor = lineStart(baseline[0], lineWidth(line, opts), opts.anchor);
    const base = baseline[1] + li * lh;

    for (const ch of line) {
      const g = ch === ' ' ? null : glyphFor(ch);

      if (!g) {
        cursor += SPACE * unit;
        continue;
      }

      const s = unit * g.scale;
      const j = opts.jitter ? opts.jitter(index++) : still;
      const cos = Math.cos(j.rot);
      const sin = Math.sin(j.rot);
      const half = (g.glyph.w * s) / 2;
      const left = cursor;

      for (const stroke of parseGlyph(g.glyph.d)) {
        out.push(
          stroke.map(([gx, gy]): Point => {
            const ly = (gy - 10) * s;
            const lx = gx * s - ly * slant - half;

            return [left + lx * cos - ly * sin + half + j.dx, base + lx * sin + ly * cos + j.dy];
          }),
        );
      }

      cursor += (g.glyph.w * g.scale + tracking) * unit;
    }
  });

  return out;
}

export const supportedCharacters = Object.keys(GLYPHS).join('');
