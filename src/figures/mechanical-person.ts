import { lerp, type Point } from '#/geometry.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';
import { handLine } from '#/stroke.ts';

import { poseOf, skeleton, standOn, type Chain, type Skeleton } from './skeleton.ts';
import type { PersonOptions } from './types.ts';

interface BodyPart {
  points: Point[];
  thickness: number;
}

function limbParts(limb: Chain, widths: readonly [number, number]): BodyPart[] {
  const [hip, knee, ankle] = limb;
  return [
    { points: [hip, knee], thickness: widths[0] },
    { points: [knee, ankle], thickness: widths[1] },
  ];
}

function foot(limb: Chain, height: number, facing: 1 | -1): BodyPart {
  const ankle = limb[2];
  return {
    points: [ankle, [ankle[0] + height * 0.06 * facing, ankle[1] + height * 0.01]],
    thickness: height * 0.035,
  };
}

function bodyParts(
  body: Skeleton,
  o: { height: number; build: number; facing: 1 | -1 },
): BodyPart[] {
  const { height, build, facing } = o;
  const shoulderSpan = height * 0.05 * build;
  const shoulder = lerp(body.neck, body.hip, 0.12);
  const waist = lerp(body.neck, body.hip, 0.7);

  const arms = body.limbs
    .slice(0, 2)
    .flatMap((limb) => limbParts(limb, [height * 0.07 * build, height * 0.055 * build]));

  const legs = body.limbs
    .slice(2)
    .flatMap((limb) => limbParts(limb, [height * 0.1 * build, height * 0.07 * build]));

  const feet = body.limbs.slice(2).map((limb) => foot(limb, height, facing));

  return [
    ...legs,
    ...feet,
    { points: [shoulder, waist], thickness: height * 0.17 * build },
    { points: [waist, body.hip], thickness: height * 0.14 * build },
    {
      points: [
        [shoulder[0] - shoulderSpan, shoulder[1]],
        [shoulder[0] + shoulderSpan, shoulder[1]],
      ],
      thickness: height * 0.08 * build,
    },
    { points: [body.neck, lerp(body.neck, body.head, 0.6)], thickness: height * 0.05 * build },
    ...arms,
  ];
}

export function mechanicalPerson(s: Sketch, at: Point, o: PersonOptions): Shape {
  const height = o.height ?? 90;
  const build = o.build ?? 1;
  const facing = o.facing ?? 1;
  const look = o.look ?? 'solid';
  const body = standOn(skeleton(poseOf(o.pose), height, facing), at);
  const line = o.width ?? Math.max(1.2, height / 60);
  const rng = s.random(`person:${at[0]}:${at[1]}`);
  const feel = { roughness: s.preset.roughness * 0.6, bowing: 0, overshoot: 0 };

  const parts = bodyParts(body, { height, build, facing }).map((part) => ({
    ...part,
    points: handLine(part.points, false, feel, rng),
  }));

  const head = body.head;
  const headSize = body.headR * 2.1 * build;
  const ink = look === 'ghost' ? (o.color ?? 'muted') : o.color;
  const flat = { roughness: 0, bowing: 0, overshoot: 0, draw: o.draw };

  const shape = s
    .group(() => {
      for (const part of parts) {
        s.stroke(
          part.points,
          false,
          { ...flat, color: ink, width: part.thickness + line * 2 },
          true,
        );
      }

      s.dot(head, { size: headSize + line * 2, color: ink, draw: o.draw });

      if (look !== 'outline') return;

      for (const part of parts) {
        s.stroke(part.points, false, { ...flat, color: 'paper', width: part.thickness }, true);
      }

      s.dot(head, { size: headSize, color: 'paper', draw: o.draw });
    })
    .together();

  if (o.opacity !== undefined) shape.opacity(o.opacity);

  if (look === 'ghost') shape.blur(height / 40).opacity(o.opacity ?? 0.5);

  return shape;
}
