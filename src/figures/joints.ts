import { clamp } from '#/geometry.ts';

import type { Limb, Pose } from './poses.ts';

export type Range = readonly [number, number];

export interface JointLimits {
  lean: Range;
  tilt: Range;
  armBack: readonly [Range, Range];
  armFront: readonly [Range, Range];
  legBack: readonly [Range, Range];
  legFront: readonly [Range, Range];
}

export const SIDE_LIMITS: JointLimits = {
  lean: [-30, 90],
  tilt: [-45, 60],
  armBack: [
    [-60, 185],
    [-5, 155],
  ],
  armFront: [
    [-60, 185],
    [-5, 155],
  ],
  legBack: [
    [-45, 130],
    [-150, 5],
  ],
  legFront: [
    [-45, 130],
    [-150, 5],
  ],
};

export const FRONT_LIMITS: JointLimits = {
  lean: [-20, 20],
  tilt: [-30, 30],
  armBack: [
    [-180, 25],
    [-150, 150],
  ],
  armFront: [
    [-25, 180],
    [-150, 150],
  ],
  legBack: [
    [-60, 15],
    [-20, 20],
  ],
  legFront: [
    [-15, 60],
    [-20, 20],
  ],
};

function limb(value: Limb, limits: readonly [Range, Range]): Limb {
  return [clamp(value[0], ...limits[0]), clamp(value[1], ...limits[1])];
}

export function limitsFor(view: Pose['view']): JointLimits {
  return view === 'front' ? FRONT_LIMITS : SIDE_LIMITS;
}

export function constrainPose(pose: Pose): Pose {
  const limits = limitsFor(pose.view);

  return {
    view: pose.view,
    lean: clamp(pose.lean, ...limits.lean),
    tilt: clamp(pose.tilt ?? 0, ...limits.tilt),
    armBack: limb(pose.armBack, limits.armBack),
    armFront: limb(pose.armFront, limits.armFront),
    legBack: limb(pose.legBack, limits.legBack),
    legFront: limb(pose.legFront, limits.legFront),
  };
}
