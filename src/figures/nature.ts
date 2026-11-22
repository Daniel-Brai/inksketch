import {
  add,
  ellipsePoints,
  lerp,
  mul,
  pointAt,
  rad,
  rotate,
  type Point,
  type Size,
} from '#/geometry.ts';
import { MAX_TREE_DEPTH } from '#/limits.ts';
import type { Ink } from '#/options.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import { scaledRoughness, scaledWidth } from './helpers.ts';
import type {
  LeafOptions,
  PlantOptions,
  PotOptions,
  ScribbleOptions,
  SunOptions,
  TreeOptions,
  WavesOptions,
} from './types.ts';

const MAX_BRANCHES = 2500;

interface Branch {
  from: Point;
  angleDeg: number;
  length: number;
  level: number;
  width: number;
}

export function tree(s: Sketch, base: Point, height: number, o: TreeOptions = {}): Shape {
  const { spreadDeg = 26, ratio = 0.74, leaves = 'none', directionDeg = 0, seed, ...ink } = o;
  const depth = Math.min(MAX_TREE_DEPTH, o.depth ?? 6);
  const trunk = o.trunk ?? Math.max(2, height / 40);
  const rng = s.random(`tree:${seed ?? `${base[0]}:${base[1]}`}`);
  const tips: Array<{ at: Point; angleDeg: number }> = [];
  let branches = 0;

  const grow = (b: Branch): void => {
    branches += 1;

    const dir: Point = [Math.sin(rad(b.angleDeg)), -Math.cos(rad(b.angleDeg))];
    const end = add(b.from, mul(dir, b.length));

    const bend = add(
      lerp(b.from, end, 0.5),
      mul([-dir[1], dir[0]], rng.range(-0.08, 0.08) * b.length),
    );

    s.stroke([b.from, bend, end], false, { ...ink, width: b.width, overshoot: 0 }, true);

    if (b.level >= depth || branches >= MAX_BRANCHES) {
      tips.push({ at: end, angleDeg: b.angleDeg });
      return;
    }

    const kids = rng.chance(0.3) ? 3 : 2;

    for (let k = 0; k < kids; k++) {
      const spread = (k / (kids - 1) - 0.5) * spreadDeg * 2;
      const angleDeg = b.angleDeg + spread + rng.range(-spreadDeg * 0.35, spreadDeg * 0.35);
      const length = b.length * ratio * rng.range(0.85, 1.1);

      grow({
        from: end,
        angleDeg,
        length,
        level: b.level + 1,
        width: Math.max(0.6, b.width * 0.7),
      });
    }
  };

  return s.group(() => {
    grow({
      from: base,
      angleDeg: directionDeg + rng.range(-3, 3),
      length: height * (1 - ratio) * 1.15,
      level: 1,
      width: trunk,
    });

    foliage(s, tips, { kind: leaves, ink });
  });
}

function blossom(s: Sketch, center: Point, o: { r: number; ink: Ink }): void {
  const petal = { ...o.ink, width: 0.5, roughness: 0.2, overshoot: 0 };

  for (let i = 0; i < 5; i++) {
    const a = rad(i * 72);
    s.circle(add(center, [Math.cos(a) * o.r, Math.sin(a) * o.r]), o.r * 0.6, petal);
  }

  s.dot(center, { size: o.r * 0.5, color: o.ink.color });
}

function foliage(
  s: Sketch,
  tips: Array<{ at: Point; angleDeg: number }>,
  o: { kind: TreeOptions['leaves']; ink: Ink },
): void {
  const rng = s.random(`foliage:${tips.length}`);

  if (o.kind === 'dots') {
    const pts = tips.flatMap((t) =>
      Array.from({ length: 4 }, (): Point => [
        t.at[0] + rng.gauss() * 4,
        t.at[1] + rng.gauss() * 4,
      ]),
    );

    s.dots(pts, { size: 2.2, color: o.ink.color });

    return;
  }

  if (o.kind === 'loops') {
    for (const t of tips) {
      if (rng.chance(0.5)) s.circle(t.at, rng.range(2, 4), { ...o.ink, width: 0.8 });
    }

    return;
  }

  if (o.kind === 'blossoms') {
    for (const t of tips) {
      if (rng.chance(0.75)) {
        blossom(s, add(t.at, [rng.gauss() * 4, rng.gauss() * 4]), {
          r: rng.range(1.3, 2.2),
          ink: o.ink,
        });
      }
    }

    return;
  }

  if (o.kind === 'leaves') {
    for (const t of tips) {
      if (rng.chance(0.6)) {
        s.leaf(t.at, rng.range(6, 11), {
          ...o.ink,
          angleDeg: t.angleDeg + rng.range(-40, 40),
          veins: false,
          shade: 'none',
          width: 0.9,
        });
      }
    }
  }
}

export function roots(s: Sketch, base: Point, length: number, o: TreeOptions = {}): Shape {
  return tree(s, base, length, {
    depth: 5,
    spreadDeg: 34,
    ratio: 0.7,
    trunk: 1.4,
    ...o,
    directionDeg: 180 + (o.directionDeg ?? 0),
  });
}

function leafOutline(length: number, widthRatio: number): { left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const w = length * widthRatio * Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.25 * u);

    left.push([-w, -u * length]);
    right.push([w, -u * length]);
  }

  return { left, right };
}

export function leaf(s: Sketch, base: Point, length: number, o: LeafOptions = {}): Shape {
  const { angleDeg = 0, widthRatio = 0.32, veins = true, shade = 'contour', ...ink } = o;
  const place = (p: Point): Point => add(rotate(p, angleDeg), base);
  const { left, right } = leafOutline(length, widthRatio);
  const outline = [...right, ...left.slice(1, -1).toReversed()].map(place);
  const thin: Ink = { ...ink, width: scaledWidth(s, ink, 0.6), overshoot: 0 };

  return s.group(() => {
    s.curve(outline, { fill: 'paper', ...ink, closed: true });

    s.stroke(
      [place([0, 0]), place([length * 0.02, -length * 0.55]), place([0, -length * 0.95])],
      false,
      thin,
      true,
    );

    if (veins) {
      for (let k = 1; k <= 4; k++) {
        const u = k / 5.5;
        const reach = pointAt(right, Math.round(u * 16) + 1)[0] * 0.8;

        s.line(place([0, -u * length]), place([reach, -(u + 0.12) * length]), thin);
        s.line(place([0, -u * length]), place([-reach, -(u + 0.12) * length]), thin);
      }
    }

    if (shade === 'contour') {
      s.contourHatch(left.map(place), {
        ...ink,
        length: length * widthRatio * 0.5,
        gap: Math.max(2, length / 14),
        side: 1,
        tiltDeg: -25,
      });
    }

    if (shade === 'hatch') s.hatch(outline, { gap: Math.max(2, length / 12) }, ink);
  });
}

export function pot(s: Sketch, top: Point, size: Size, o: PotOptions = {}): Shape {
  const { soil = true, shade = 'hatch', ...ink } = o;
  const [cx, ty] = top;
  const [w, h] = size;
  const rimH = h * 0.18;
  const rimOut = w * 0.06;

  const body: Point[] = [
    [cx - w / 2, ty + rimH],
    [cx + w / 2, ty + rimH],
    [cx + w * 0.36, ty + h],
    [cx - w * 0.36, ty + h],
  ];

  const shadow: Point[] = [
    [cx + w * 0.2, ty + rimH],
    [cx + w / 2, ty + rimH],
    [cx + w * 0.36, ty + h],
    [cx + w * 0.12, ty + h],
  ];

  return s.group(() => {
    if (soil) {
      s.stipple(ellipsePoints([cx, ty + 1], [w / 2, Math.max(2, h * 0.06)]), { density: 6 }, ink);
    }

    s.polygon(body, { fill: 'paper', ...ink });
    s.rect([cx - w / 2 - rimOut, ty], [w + rimOut * 2, rimH], { fill: 'paper', ...ink });

    s.shade(shadow, shade, {
      ...ink,
      angleDeg: 75,
      gap: 4,
      from: 'right',
      strength: 0.6,
      density: 4,
    });
  });
}

export function plant(s: Sketch, base: Point, height: number, o: PlantOptions = {}): Shape {
  const { leaves = 5, pot: withPot = true, potSize, swayDeg = 6, ...ink } = o;
  const rng = s.random(`plant:${base[0]}:${base[1]}`);
  const sway = Math.sin(rad(swayDeg)) * height;

  const stem: Point[] = [
    base,
    [base[0] + sway * 0.3, base[1] - height * 0.35],
    [base[0] - sway * 0.2, base[1] - height * 0.7],
    [base[0] + sway * 0.1, base[1] - height],
  ];

  return s.group(() => {
    if (withPot) s.pot(base, potSize ?? [height * 0.55, height * 0.45], ink);

    s.curve(stem, ink);

    for (let i = 0; i < leaves; i++) {
      const u = (i + 1) / (leaves + 1);
      const side = i % 2 === 0 ? 1 : -1;

      const at = lerp(
        pointAt(stem, Math.min(2, Math.floor(u * 3))),
        pointAt(stem, Math.min(3, Math.floor(u * 3) + 1)),
        (u * 3) % 1,
      );

      s.leaf(at, height * (0.42 - u * 0.2), { ...ink, angleDeg: side * rng.range(40, 65) });
    }

    s.leaf(pointAt(stem, 3), height * 0.18, { ...ink, angleDeg: rng.range(-10, 10), veins: false });
  });
}

export function sun(s: Sketch, center: Point, r: number, o: SunOptions = {}): Shape {
  const { rays = 10, rayLength = r * 0.6, ...ink } = o;

  return s.group(() => {
    s.circle(center, r, ink);

    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * 360;
      const reach = i % 2 === 0 ? rayLength : rayLength * 0.6;
      const v: Point = [Math.cos(rad(a)), Math.sin(rad(a))];

      s.line(add(center, mul(v, r * 1.3)), add(center, mul(v, r * 1.3 + reach)), ink);
    }
  });
}

export function waves(s: Sketch, at: Point, width: number, o: WavesOptions = {}): Shape {
  const { amplitude = 5, wavelength = 36, rows = 1, rowGap = 14, ...ink } = o;

  return s.group(() => {
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * wavelength * 0.5;
      const pts: Point[] = [];

      for (let px = 0; px <= width; px += 4) {
        pts.push([
          at[0] + px,
          at[1] + r * rowGap + Math.sin(((px + shift) / wavelength) * Math.PI * 2) * amplitude,
        ]);
      }

      s.stroke(pts, false, ink, true);
    }
  });
}

export function scribble(s: Sketch, center: Point, r: number, o: ScribbleOptions = {}): Shape {
  const { turns = 6, ...ink } = o;
  const rng = s.random(`scribble:${center[0]}:${center[1]}`);
  const pts: Point[] = [];
  let loopCenter = center;

  for (let i = 0; i <= turns * 24; i++) {
    if (i % 24 === 0) {
      loopCenter = [center[0] + rng.gauss() * r * 0.2, center[1] + rng.gauss() * r * 0.2];
    }

    const a = (i / 24) * Math.PI * 2;
    const reach = r * rng.range(0.55, 1);

    pts.push([loopCenter[0] + Math.cos(a) * reach, loopCenter[1] + Math.sin(a) * reach * 0.85]);
  }

  return s.curve(pts, { ...ink, roughness: scaledRoughness(s, ink, 1.2) });
}
