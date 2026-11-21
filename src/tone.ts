import { clamp, rad, type Box, type Point } from './geometry.ts';
import { hashSeed, planeNoise } from './random.ts';

export type ToneField = (p: Point) => number;

export interface PixelGrid {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export type ShadeFrom = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'edge' | number;

function sideAngle(from: 'top' | 'bottom' | 'left' | 'right' | number): number {
  switch (from) {
    case 'top':
      return -90;
    case 'bottom':
      return 90;
    case 'left':
      return 180;
    case 'right':
      return 0;
    default:
      return from;
  }
}

function sample(grid: PixelGrid, x: number, y: number): number {
  const cx = Math.max(0, Math.min(grid.width - 1, x));
  const cy = Math.max(0, Math.min(grid.height - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const at = (ix: number, iy: number): number => grid.data[iy * grid.width + ix] ?? 0;
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;

  return top * (1 - ty) + bottom * ty;
}

export const tones = {
  constant(value: number): ToneField {
    const v = clamp(value);
    return () => v;
  },

  linear(from: Point, to: Point): ToneField {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len2 = dx * dx + dy * dy || 1;

    return (p) => clamp(((p[0] - from[0]) * dx + (p[1] - from[1]) * dy) / len2);
  },

  radial(center: Point, radius: number): ToneField {
    return (p) => clamp(1 - Math.hypot(p[0] - center[0], p[1] - center[1]) / (radius || 1));
  },

  side(box: Box, from: ShadeFrom): ToneField {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    if (from === 'center' || from === 'edge') {
      const reach = Math.hypot(box.w, box.h) / 2 || 1;
      const inward = from === 'center';

      return (p) => {
        const r = clamp(Math.hypot(p[0] - cx, p[1] - cy) / reach);
        return inward ? 1 - r : r;
      };
    }

    const a = rad(sideAngle(from));
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const half = (Math.abs(dx) * box.w + Math.abs(dy) * box.h) / 2 || 1;

    return (p) => clamp(((p[0] - cx) * dx + (p[1] - cy) * dy) / half / 2 + 0.5);
  },

  noise(
    o: { seed?: number | string; scale?: number; octaves?: number; contrast?: number } = {},
  ): ToneField {
    const base = hashSeed(String(o.seed ?? 'tone'));
    const octaves = Math.max(1, Math.min(6, o.octaves ?? 4));

    const layers = Array.from({ length: octaves }, (_, i) =>
      planeNoise(base + i * 1013, (o.scale ?? 80) / 2 ** i),
    );

    const contrast = o.contrast ?? 1.4;

    return (p) => {
      let v = 0;
      let weight = 0;

      let w = 1;

      for (const layer of layers) {
        v += layer(p[0], p[1]) * w;
        weight += w;
        w *= 0.5;
      }

      return clamp((v / weight) * contrast * 0.5 + 0.5);
    };
  },

  pixels(grid: PixelGrid, box: Box, o: { invert?: boolean; gamma?: number } = {}): ToneField {
    const gamma = o.gamma ?? 1;
    const invert = o.invert ?? true;

    return (p) => {
      const x = ((p[0] - box.x) / (box.w || 1)) * grid.width;
      const y = ((p[1] - box.y) / (box.h || 1)) * grid.height;
      const light = clamp(sample(grid, x, y) / 255);
      const dark = invert ? 1 - light : light;

      return dark ** gamma;
    };
  },

  multiply(a: ToneField, b: ToneField): ToneField {
    return (p) => a(p) * b(p);
  },

  max(a: ToneField, b: ToneField): ToneField {
    return (p) => Math.max(a(p), b(p));
  },

  mix(a: ToneField, b: ToneField, t: number): ToneField {
    return (p) => a(p) * (1 - t) + b(p) * t;
  },

  contrast(field: ToneField, amount: number): ToneField {
    return (p) => clamp((field(p) - 0.5) * amount + 0.5);
  },
};
