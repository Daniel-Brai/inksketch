import { add, lerp, mul, rad, type Point } from '#/geometry.ts';

import { constrainPose } from './joints.ts';
import { poses, type Limb, type Pose } from './poses.ts';
import type { StickFigureOptions } from './types.ts';

export type Chain = readonly [Point, Point, Point];

export interface Skeleton {
  head: Point;
  headR: number;
  neck: Point;
  hip: Point;
  limbs: readonly [Chain, Chain, Chain, Chain];
}

export interface Proportions {
  head: number;
  limbs: number;
}

const ADULT: Proportions = { head: 1, limbs: 1 };

export function poseOf(pose: StickFigureOptions['pose']): Pose {
  if (typeof pose === 'object') return pose;

  return poses[pose ?? 'stand'];
}

export function skeleton(
  raw: Pose,
  height: number,
  facing: 1 | -1,
  proportions: Proportions = ADULT,
): Skeleton {
  const pose = constrainPose(raw);
  const dir = (deg: number): Point => [Math.sin(rad(deg)) * facing, Math.cos(rad(deg))];
  const hip: Point = [0, 0];
  const neck = add(hip, mul(dir(180 - pose.lean), 0.36 * height));
  const shoulder = lerp(neck, hip, 0.1);
  const headR = 0.11 * height * proportions.head;
  const head = add(neck, mul(dir(180 - pose.lean - (pose.tilt ?? 0) * 0.5), headR * 1.15));

  const limb = (base: Point, l: Limb, lengths: readonly [number, number]): Chain => {
    const joint = add(base, mul(dir(l[0]), lengths[0] * height * proportions.limbs));
    return [
      base,
      joint,
      add(joint, mul(dir(l[0] + l[1]), lengths[1] * height * proportions.limbs)),
    ];
  };

  const limbs: Skeleton['limbs'] = [
    limb(shoulder, pose.armBack, [0.19, 0.18]),
    limb(shoulder, pose.armFront, [0.19, 0.18]),
    limb(hip, pose.legBack, [0.24, 0.23]),
    limb(hip, pose.legFront, [0.24, 0.23]),
  ];

  return { head, headR, neck, hip, limbs };
}

function shiftChain(chain: Chain, shift: Point): Chain {
  return [add(chain[0], shift), add(chain[1], shift), add(chain[2], shift)];
}

export function standOn(body: Skeleton, at: Point): Skeleton {
  const [armBack, armFront, legBack, legFront] = body.limbs;
  const lowest = Math.max(...body.limbs.flat().map((p) => p[1]));
  const shift: Point = [at[0], at[1] - lowest];

  return {
    head: add(body.head, shift),
    headR: body.headR,
    neck: add(body.neck, shift),
    hip: add(body.hip, shift),
    limbs: [
      shiftChain(armBack, shift),
      shiftChain(armFront, shift),
      shiftChain(legBack, shift),
      shiftChain(legFront, shift),
    ],
  };
}
