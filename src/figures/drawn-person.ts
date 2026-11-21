import { traceContours } from '#/contour.ts';
import type { FillSpec } from '#/fills.ts';
import { add, lerp, pointAt, polygonArea, type Point } from '#/geometry.ts';
import type { Ink } from '#/options.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';
import type { Color } from '#/style.ts';

import { BODIES, SILHOUETTE_CACHE_LIMIT, type BodyBuild } from './body.constants.ts';
import { holdProp, type Grip } from './props.ts';
import { bodyBox, bodyField, thinLoop, type Capsule, type Egg } from './silhouette.ts';
import { poseOf, skeleton, standOn, type Chain, type Skeleton } from './skeleton.ts';
import type { Hair, Outfit, PersonOptions } from './types.ts';

interface FigureSpec {
  height: number;
  facing: 1 | -1;
  build: number;
  shape: BodyBuild;
  outfit: Outfit;
  hair: Hair;
  tilt: number;
}

const silhouettes = new Map<string, Point[][]>();

function remember(key: string, loops: Point[][]): Point[][] {
  if (silhouettes.size >= SILHOUETTE_CACHE_LIMIT) {
    const oldest = silhouettes.keys().next();
    if (!oldest.done) silhouettes.delete(oldest.value);
  }

  silhouettes.set(key, loops);

  return loops;
}

function limbCapsules(
  points: Chain,
  radii: readonly [number, number, number],
  scale: number,
): Capsule[] {
  return [
    { from: points[0], to: points[1], radii: [radii[0] * scale, radii[1] * scale] },
    { from: points[1], to: points[2], radii: [radii[1] * scale, radii[2] * scale] },
  ];
}

function hand(points: Chain, scale: number): Capsule {
  const [, joint, end] = points;
  const dx = end[0] - joint[0];
  const dy = end[1] - joint[1];
  const len = Math.hypot(dx, dy) || 1;
  const reach = 0.045 * scale;

  return {
    from: end,
    to: [end[0] + (dx / len) * reach, end[1] + (dy / len) * reach],
    radii: [0.026 * scale, 0.02 * scale],
  };
}

function foot(points: Chain, o: { scale: number; facing: 1 | -1 }): Capsule {
  const ankle = points[2];
  return {
    from: ankle,
    to: [ankle[0] + 0.065 * o.scale * o.facing, ankle[1] + 0.012 * o.scale],
    radii: [0.024 * o.scale, 0.017 * o.scale],
  };
}

function outfitCapsules(body: Skeleton, spec: FigureSpec, waist: Point): Capsule[] {
  const h = spec.height * spec.build;
  const knees = lerp(body.limbs[2][1], body.limbs[3][1], 0.5);

  switch (spec.outfit) {
    case 'skirt':
      return [
        {
          from: waist,
          to: lerp(waist, knees, 0.8),
          radii: [0.07 * h * spec.shape.hips, 0.095 * h * spec.shape.hips],
        },
      ];
    case 'dress':
      return [
        {
          from: lerp(body.neck, waist, 0.5),
          to: lerp(waist, knees, 0.95),
          radii: [0.068 * h, 0.1 * h * spec.shape.hips],
        },
      ];
    case 'coat':
      return [
        {
          from: lerp(body.neck, waist, 0.2),
          to: lerp(waist, knees, 0.6),
          radii: [0.1 * h * spec.shape.shoulders, 0.1 * h * spec.shape.hips],
        },
      ];
    case 'trousers':
      return [];
  }
}

function hairCapsules(head: Egg, spec: FigureSpec): { capsules: Capsule[]; eggs: Egg[] } {
  const r = head.radii[1];
  const back = -spec.facing;
  const [cx, cy] = head.center;

  switch (spec.hair) {
    case 'short':
      return {
        capsules: [],
        eggs: [
          {
            ...head,
            center: [cx + back * r * 0.05, cy - r * 0.06],
            radii: [head.radii[0] * 1.06, head.radii[1] * 1.02],
          },
        ],
      };
    case 'long':
      return {
        capsules: [
          {
            from: [cx + back * r * 0.35, cy - r * 0.2],
            to: [cx + back * r * 0.55, cy + r * 1.6],
            radii: [r * 0.75, r * 0.55],
          },
        ],
        eggs: [],
      };
    case 'bun':
      return {
        capsules: [],
        eggs: [
          {
            center: [cx + back * r * 0.55, cy - r * 0.85],
            radii: [r * 0.38, r * 0.38],
            tiltDeg: 0,
          },
        ],
      };
    case 'ponytail':
      return {
        capsules: [
          {
            from: [cx + back * r * 0.55, cy - r * 0.35],
            to: [cx + back * r * 0.95, cy + r * 0.95],
            radii: [r * 0.26, r * 0.14],
          },
        ],
        eggs: [],
      };
    case 'none':
      return { capsules: [], eggs: [] };
  }
}

function bodyShape(body: Skeleton, spec: FigureSpec): { capsules: Capsule[]; eggs: Egg[] } {
  const h = spec.height * spec.build;
  const b = spec.shape;
  const shoulder = lerp(body.neck, body.hip, 0.1);
  const waist = lerp(body.neck, body.hip, 0.68);
  const [armBack, armFront, legBack, legFront] = body.limbs;

  const head: Egg = {
    center: body.head,
    radii: [0.05 * h * b.head, 0.066 * h * b.head],
    tiltDeg: spec.tilt * spec.facing,
  };

  const hair = hairCapsules(head, spec);

  const capsules: Capsule[] = [
    ...limbCapsules(legBack, [0.05 * b.thigh, 0.034, 0.021], h),
    ...limbCapsules(legFront, [0.05 * b.thigh, 0.034, 0.021], h),
    foot(legBack, { scale: h, facing: spec.facing }),
    foot(legFront, { scale: h, facing: spec.facing }),
    { from: shoulder, to: waist, radii: [0.082 * h * b.shoulders, 0.064 * h * b.waist] },
    { from: waist, to: body.hip, radii: [0.064 * h * b.waist, 0.068 * h * b.hips] },
    { from: body.neck, to: lerp(body.neck, body.head, 0.7), radii: [0.03 * h, 0.028 * h] },
    ...outfitCapsules(body, spec, waist),
    ...limbCapsules(armBack, [0.028 * b.arm, 0.023 * b.arm, 0.018 * b.arm], h),
    ...limbCapsules(armFront, [0.028 * b.arm, 0.023 * b.arm, 0.018 * b.arm], h),
    hand(armBack, h),
    hand(armFront, h),
    ...hair.capsules,
  ];

  return { capsules, eggs: [head, ...hair.eggs] };
}

const TRACE_HEIGHT = 120;

function canonicalSilhouette(o: PersonOptions, spec: FigureSpec): Point[][] {
  const key = JSON.stringify([
    o.pose ?? 'stand',
    spec.build,
    o.body ?? 'neutral',
    spec.outfit,
    spec.hair,
  ]);

  const hit = silhouettes.get(key);

  if (hit) return hit;

  const unit: FigureSpec = { ...spec, height: TRACE_HEIGHT, facing: 1 };

  const body = standOn(
    skeleton(poseOf(o.pose), TRACE_HEIGHT, 1, { head: spec.shape.head, limbs: spec.shape.limbs }),
    [0, 0],
  );

  const shape = bodyShape(body, unit);
  const cell = TRACE_HEIGHT / 120;
  const smallest = (TRACE_HEIGHT * 0.06) ** 2;

  const loops = traceContours(bodyField(shape), bodyBox(shape, 4), cell)
    .filter((loop) => polygonArea(loop) >= smallest)
    .map((loop) => thinLoop(loop, cell * 3.5));

  return remember(key, loops);
}

function silhouette(o: PersonOptions, spec: FigureSpec): Point[][] {
  const k = spec.height / TRACE_HEIGHT;
  const flip = spec.facing;

  return canonicalSilhouette(o, spec).map((loop) =>
    loop.map(([x, y]): Point => [x * k * flip, y * k]),
  );
}

function inkContour(
  s: Sketch,
  loop: Point[],
  o: { width: number; color: Color | undefined },
): void {
  const rng = s.random(`contour:${s.nextId()}`);
  const pieces = rng.int(3, 4);
  const start = rng.int(0, loop.length - 1);
  const ring = [...loop.slice(start), ...loop.slice(0, start)];
  const step = Math.floor(ring.length / pieces);
  const overlap = Math.max(2, Math.round(step * 0.12));

  const ink: Ink = {
    width: o.width,
    color: o.color,
    roughness: s.preset.roughness * 0.7,
    bowing: 0.3,
    overshoot: o.width * 1.2,
    pressure: 0.6,
  };

  for (let i = 0; i < pieces; i++) {
    const from = i * step;
    const to = i === pieces - 1 ? ring.length + overlap : (i + 1) * step + overlap;

    const piece = Array.from({ length: to - from }, (_, k) =>
      pointAt(ring, (from + k) % ring.length),
    );

    s.stroke(piece, false, ink, true);
  }
}

function gripOf(o: PersonOptions, spec: FigureSpec, at: Point): Grip {
  const body = standOn(
    skeleton(poseOf(o.pose), spec.height, spec.facing, {
      head: spec.shape.head,
      limbs: spec.shape.limbs,
    }),
    at,
  );

  const arm = body.limbs[1];

  return { hand: arm[2], forearm: arm[1], height: spec.height };
}

function silhouetteFill(look: PersonOptions['look'], color: Color | undefined): FillSpec {
  if (look === 'outline') return 'paper';

  return { type: 'solid', color };
}

export function drawnPerson(s: Sketch, at: Point, o: PersonOptions): Shape {
  const look = o.look ?? 'solid';
  const pose = poseOf(o.pose);

  const spec: FigureSpec = {
    height: o.height ?? 90,
    facing: o.facing ?? 1,
    build: o.build ?? 1,
    shape: BODIES[o.body ?? 'neutral'],
    outfit: o.outfit ?? 'trousers',
    hair: o.hair ?? 'none',
    tilt: pose.lean + (pose.tilt ?? 0),
  };

  const loops = silhouette(o, spec).map((loop) =>
    loop.map((p) => add(p, [at[0], at[1] - spec.height * 0.012])),
  );

  const width = o.width ?? Math.max(1.1, spec.height / 75);
  const ink = look === 'ghost' ? (o.color ?? 'muted') : o.color;
  const fill = silhouetteFill(look, ink);

  const figure = s.group(() => {
    for (const loop of loops) {
      s.polygon(loop, { stroke: false, fill, roughness: s.preset.roughness * 0.2, draw: o.draw });
      inkContour(s, loop, { width, color: ink });
    }

    if (o.prop) {
      holdProp(s, o.prop, {
        grip: gripOf(o, spec, at),
        ink: { width, color: ink },
        text: o.propText ?? null,
      });
    }
  });

  if (o.opacity !== undefined) figure.opacity(o.opacity);

  if (look === 'ghost') figure.blur(spec.height / 45).opacity(o.opacity ?? 0.55);

  return figure;
}
