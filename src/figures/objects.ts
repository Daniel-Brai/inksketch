import { shadeFill } from '#/fills.ts';
import { add, ellipsePoints, mul, rad, type Point, type Size } from '#/geometry.ts';
import type { Ink } from '#/options.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import { scaledRoughness, scaledWidth } from './helpers.ts';
import type {
  CloudOptions,
  CubeOptions,
  CylinderOptions,
  DocumentOptions,
  GearOptions,
  LightbulbOptions,
  ServerOptions,
  StoneOptions,
} from './types.ts';

export function stone(s: Sketch, center: Point, r: number, o: StoneOptions = {}): Shape {
  const { shade = 'stipple', squash = 0.7, lightDeg = -120, ...ink } = o;

  const fill =
    ink.fill ??
    shadeFill(shade, { from: lightDeg + 180, density: 4, strength: 0.85, color: ink.color });

  return s.blob(center, [r, r * squash], { irregularity: 0.12, flatBottom: 0.25, ...ink, fill });
}

export function cylinder(s: Sketch, center: Point, o: CylinderOptions = {}): Shape {
  const {
    rx = 60,
    height = rx * 1.7,
    rings = 2,
    shade = 'none',
    label,
    labelSize,
    fill,
    ...ink
  } = o;

  const ry = o.ry ?? rx * 0.28;
  const [cx, cy] = center;
  const top = cy - height / 2;
  const bottom = cy + height / 2;

  return s.group(() => {
    const silhouette = [
      ...ellipsePoints([cx, top], [rx, ry], [180, 360]),
      ...ellipsePoints([cx, bottom], [rx, ry], [0, 180]),
    ];

    s.polygon(silhouette, { stroke: false, fill: fill ?? 'paper', draw: ink.draw });
    s.ellipse([cx, top], [rx, ry], ink);
    s.line([cx - rx, top], [cx - rx, bottom], ink);
    s.line([cx + rx, top], [cx + rx, bottom], ink);
    s.arc([cx, bottom], [rx, ry], { ...ink, fromDeg: 0, toDeg: 180 });

    for (let i = 1; i <= rings; i++) {
      const y = top + (height * i) / (rings + 1);
      s.arc([cx, y], [rx, ry], { ...ink, width: scaledWidth(s, ink, 0.8), fromDeg: 8, toDeg: 172 });
    }

    const band = [
      ...ellipsePoints([cx, top], [rx * 0.98, ry], [62, 4]),
      ...ellipsePoints([cx, bottom], [rx * 0.98, ry], [4, 62]),
    ];

    s.shade(band, shade, { ...ink, angleDeg: 70, gap: 5, from: 0, strength: 0.7, density: 3 });

    if (label) {
      s.label([cx, cy + ry * 0.4], label, {
        size: labelSize ?? Math.max(12, rx * 0.28),
        color: ink.color,
      });
    }
  });
}

export function cube(s: Sketch, at: Point, size: number, o: CubeOptions = {}): Shape {
  const { depth = size * 0.45, angleDeg = -35, shade = 'hatch', label, labelSize, ...ink } = o;
  const d: Point = [Math.cos(rad(angleDeg)) * depth, Math.sin(rad(angleDeg)) * depth];
  const [x, y] = at;
  const a: Point = [x, y];
  const b: Point = [x + size, y];
  const c: Point = [x + size, y + size];
  const e: Point = [x, y + size];
  const back = (p: Point): Point => add(p, d);

  return s.group(() => {
    s.polygon([a, back(a), back(b), b, c, e], { stroke: false, fill: 'paper', draw: ink.draw });
    s.polygon([a, b, c, e], ink);
    s.polyline([a, back(a), back(b), b], ink);
    s.polyline([back(b), back(c), c], ink);

    s.shade([b, back(b), back(c), c], shade, {
      ...ink,
      angleDeg: 80,
      gap: 5,
      from: 0,
      strength: 0.5,
      density: 3.5,
    });

    if (label) {
      s.label([x + size / 2, y + size / 2], label, {
        size: labelSize ?? Math.max(12, size * 0.16),
        color: ink.color,
      });
    }
  });
}

export function documentSheet(s: Sketch, at: Point, size: Size, o: DocumentOptions = {}): Shape {
  const [x, y] = at;
  const [w, h] = size;
  const { fold = w * 0.24, lines = 5, title, ...ink } = o;
  const rng = s.random(`doc:${x}:${y}`);
  const step = (h - fold - 10) / (lines + 1);

  const lineInk: Ink = {
    ...ink,
    width: scaledWidth(s, ink, 0.7),
    roughness: scaledRoughness(s, ink, 1.6),
  };

  return s.group(() => {
    s.polygon(
      [
        [x, y],
        [x + w - fold, y],
        [x + w, y + fold],
        [x + w, y + h],
        [x, y + h],
      ],
      { fill: 'paper', ...ink },
    );

    s.polyline(
      [
        [x + w - fold, y],
        [x + w - fold, y + fold],
        [x + w, y + fold],
      ],
      ink,
    );

    if (title) {
      s.text([x + w * 0.14, y + fold * 0.8], title, {
        size: Math.max(11, Math.min(16, w * 0.16)),
        color: ink.color,
      });
    }

    for (let i = 1; i <= lines; i++) {
      const ty = y + fold + 6 + step * i;
      const share = i === lines ? rng.range(0.35, 0.6) : rng.range(0.75, 1);

      s.line([x + w * 0.14, ty], [x + w * 0.14 + w * 0.72 * share, ty], lineInk);
    }
  });
}

export function cloud(s: Sketch, center: Point, size: Size, o: CloudOptions = {}): Shape {
  const { bumps = 7, label, labelSize, ...ink } = o;
  const [cx, cy] = center;
  const [w, h] = size;
  const phase = s.random(`cloud:${cx}:${cy}`).range(0, Math.PI);
  const pts: Point[] = [];

  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2;
    const k = 0.82 + 0.2 * Math.abs(Math.sin((bumps * a) / 2 + phase));
    const dy = Math.sin(a) * (h / 2) * k;

    pts.push([cx + Math.cos(a) * (w / 2) * k, cy + (dy > 0 ? dy * 0.75 : dy)]);
  }

  return s.group(() => {
    s.curve(pts, { fill: 'paper', ...ink, closed: true });

    if (label) {
      s.label(center, label, { size: labelSize ?? Math.max(12, h * 0.22), color: ink.color });
    }
  });
}

export function server(s: Sketch, at: Point, size: Size, o: ServerOptions = {}): Shape {
  const { units = 3, label, ...ink } = o;
  const [x, y] = at;
  const [w, h] = size;
  const uh = h / units;
  const led = Math.max(3, uh * 0.14);

  return s.group(() => {
    for (let i = 0; i < units; i++) {
      const mid = y + i * uh + uh / 2;

      s.rect([x, y + i * uh], [w, uh], { fill: 'paper', ...ink });
      s.line([x + w * 0.12, mid], [x + w * 0.5, mid], { ...ink, width: scaledWidth(s, ink, 0.8) });
      s.dot([x + w * 0.75, mid], { size: led, color: ink.color });
      s.dot([x + w * 0.86, mid], { size: led, color: ink.color });
    }

    if (label) s.label([x + w / 2, y + h + 18], label, { size: 14, color: ink.color });
  });
}

export function lightbulb(s: Sketch, center: Point, r: number, o: LightbulbOptions = {}): Shape {
  const { rays = true, filament = true, ...ink } = o;
  const [cx, cy] = center;
  const neck = r * 0.42;

  const glass: Point[] = [
    [cx - neck, cy + r * 1.25],
    ...ellipsePoints(center, [r, r], [135, 405]),
    [cx + neck, cy + r * 1.25],
  ];

  const filamentPath: Point[] = [
    [cx - r * 0.25, cy + r * 1.2],
    [cx - r * 0.25, cy + r * 0.1],
    [cx - r * 0.12, cy - r * 0.1],
    [cx, cy + r * 0.1],
    [cx + r * 0.12, cy - r * 0.1],
    [cx + r * 0.25, cy + r * 0.1],
    [cx + r * 0.25, cy + r * 1.2],
  ];

  return s.group(() => {
    s.curve(glass, { fill: 'paper', ...ink, closed: true });

    for (let i = 0; i < 3; i++) {
      const yy = cy + r * (1.4 + i * 0.22);
      const inset = i === 2 ? r * 0.12 : 0;

      s.line([cx - neck + inset, yy], [cx + neck - inset, yy], ink);
    }

    if (filament) s.polyline(filamentPath, { ...ink, width: scaledWidth(s, ink, 0.6) });

    if (!rays) return;

    for (const a of [-160, -125, -90, -55, -20]) {
      const v: Point = [Math.cos(rad(a)), Math.sin(rad(a))];
      s.line(add(center, mul(v, r * 1.35)), add(center, mul(v, r * 1.75)), ink);
    }
  });
}

export function gear(s: Sketch, center: Point, r: number, o: GearOptions = {}): Shape {
  const { teeth = 10, toothDepth = 0.22, hole = 0.3, ...ink } = o;
  const inner = r * (1 - toothDepth);
  const step = 360 / teeth;

  const ring = (radius: number, deg: number): Point => [
    center[0] + Math.cos(rad(deg)) * radius,
    center[1] + Math.sin(rad(deg)) * radius,
  ];

  const pts: Point[] = [];

  for (let i = 0; i < teeth; i++) {
    const a = i * step;

    pts.push(
      ring(inner, a),
      ring(r, a + step * 0.15),
      ring(r, a + step * 0.45),
      ring(inner, a + step * 0.6),
    );
  }

  return s.group(() => {
    s.polygon(pts, { fill: 'paper', ...ink, roughness: scaledRoughness(s, ink, 0.6) });
    if (hole > 0) s.circle(center, r * hole, ink);
  });
}
