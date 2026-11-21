export type Limb = readonly [number, number];

export interface Pose {
  view?: 'side' | 'front' | undefined;
  lean: number;
  armBack: Limb;
  armFront: Limb;
  legBack: Limb;
  legFront: Limb;
  tilt?: number | undefined;
}

export const poses = {
  stand: { lean: 0, armBack: [-10, 0], armFront: [10, 0], legBack: [-7, 0], legFront: [7, 0] },
  walk: { lean: 4, armBack: [-28, 12], armFront: [30, 25], legBack: [-22, -18], legFront: [24, 0] },
  walk2: {
    lean: 4,
    armBack: [22, 20],
    armFront: [-24, 10],
    legBack: [14, 0],
    legFront: [-18, -24],
  },
  run: {
    lean: 14,
    armBack: [-50, 80],
    armFront: [60, 85],
    legBack: [-45, -70],
    legFront: [55, -35],
  },
  wave: {
    lean: 0,
    armBack: [-10, 0],
    armFront: [150, 25],
    legBack: [-7, 0],
    legFront: [7, 0],
    tilt: 6,
  },
  cheer: {
    view: 'front',
    lean: 0,
    armBack: [-150, -10],
    armFront: [150, 10],
    legBack: [-12, 0],
    legFront: [12, 0],
    tilt: -6,
  },
  think: {
    lean: 2,
    armBack: [15, 95],
    armFront: [18, 150],
    legBack: [-6, 0],
    legFront: [6, 0],
    tilt: 10,
  },
  point: { lean: 3, armBack: [-12, 0], armFront: [88, 0], legBack: [-8, 0], legFront: [10, 0] },
  shrug: {
    view: 'front',
    lean: 0,
    armBack: [-40, -105],
    armFront: [40, 105],
    legBack: [-7, 0],
    legFront: [7, 0],
    tilt: 8,
  },
  lift: {
    view: 'front',
    lean: 0,
    armBack: [-168, 0],
    armFront: [168, 0],
    legBack: [-14, 0],
    legFront: [14, 0],
  },
  push: { lean: 22, armBack: [75, 15], armFront: [82, 10], legBack: [-32, 0], legFront: [12, -10] },
  sit: { lean: -4, armBack: [8, 50], armFront: [14, 55], legBack: [82, -82], legFront: [86, -86] },
  sad: {
    lean: 10,
    armBack: [-4, 0],
    armFront: [4, 0],
    legBack: [-5, 0],
    legFront: [5, 0],
    tilt: 24,
  },
  tpose: {
    view: 'front',
    lean: 0,
    armBack: [-90, 0],
    armFront: [90, 0],
    legBack: [-9, 0],
    legFront: [9, 0],
  },
  handsOnHips: {
    lean: 0,
    armBack: [-25, 60],
    armFront: [25, 60],
    legBack: [-4, 0],
    legFront: [4, 0],
  },
  holdDisc: { lean: 0, armBack: [-12, 0], armFront: [15, 25], legBack: [0, 0], legFront: [0, 0] },
  lookUp: {
    lean: -3,
    armBack: [0, 0],
    armFront: [0, 0],
    legBack: [-3, 0],
    legFront: [3, 0],
    tilt: -15,
  },
  lookDown: {
    lean: 5,
    armBack: [5, 10],
    armFront: [5, 10],
    legBack: [-3, 0],
    legFront: [3, 0],
    tilt: 35,
  },
  walkHunched: {
    lean: 25,
    armBack: [30, 20],
    armFront: [30, 20],
    legBack: [-10, 0],
    legFront: [20, 10],
    tilt: 25,
  },
  crouchReach: {
    lean: 55,
    armBack: [20, 0],
    armFront: [80, 5],
    legBack: [60, -120],
    legFront: [70, -110],
    tilt: 20,
  },
  squat: {
    lean: 45,
    armBack: [30, 0],
    armFront: [85, 10],
    legBack: [75, -130],
    legFront: [70, -125],
    tilt: 20,
  },
  kneel: {
    lean: 50,
    armBack: [40, 30],
    armFront: [60, 20],
    legBack: [-10, -130],
    legFront: [80, -100],
    tilt: 40,
  },
  armsUp: {
    view: 'front',
    lean: 0,
    armBack: [-160, 0],
    armFront: [160, 0],
    legBack: [-6, 0],
    legFront: [6, 0],
  },
  offer: { lean: 0, armBack: [0, 0], armFront: [90, 0], legBack: [-4, 0], legFront: [4, 0] },
  present: { lean: 0, armBack: [0, 0], armFront: [70, 10], legBack: [-4, 0], legFront: [5, 0] },
  raiseHand: { lean: 0, armBack: [0, 0], armFront: [150, 10], legBack: [-4, 0], legFront: [4, 0] },
  sitLaptop: {
    lean: -10,
    armBack: [0, 0],
    armFront: [45, 60],
    legBack: [80, 0],
    legFront: [80, -85],
    tilt: -5,
  },
  sitSplayed: {
    lean: 25,
    armBack: [30, 20],
    armFront: [30, 20],
    legBack: [85, 10],
    legFront: [80, 10],
    tilt: 15,
  },
  bow: {
    lean: 45,
    armBack: [20, 0],
    armFront: [20, 0],
    legBack: [0, 0],
    legFront: [5, 0],
    tilt: 30,
  },
  leanBack: {
    lean: -5,
    armBack: [-20, 0],
    armFront: [10, 0],
    legBack: [-15, 0],
    legFront: [20, 5],
    tilt: -5,
  },
  grapple: {
    lean: 35,
    armBack: [60, 20],
    armFront: [70, 30],
    legBack: [-20, 0],
    legFront: [30, -10],
    tilt: 20,
  },
  stop: {
    lean: -4,
    armBack: [-10, 5],
    armFront: [90, -5],
    legBack: [-12, 0],
    legFront: [10, 0],
    tilt: -4,
  },
  beckon: {
    lean: 6,
    armBack: [-8, 10],
    armFront: [60, 110],
    legBack: [-6, 0],
    legFront: [8, 0],
    tilt: 6,
  },
  holdSign: {
    lean: 10,
    armBack: [-35, 20],
    armFront: [150, -5],
    legBack: [-25, -10],
    legFront: [20, -5],
    tilt: -10,
  },
  rush: {
    lean: 30,
    armBack: [-55, 70],
    armFront: [70, 80],
    legBack: [-40, -80],
    legFront: [60, -30],
    tilt: 10,
  },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof poses;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const mix = (x: number, y: number): number => x + (y - x) * t;
  const limb = (x: Limb, y: Limb): Limb => [mix(x[0], y[0]), mix(x[1], y[1])];

  return {
    view: t < 0.5 ? a.view : b.view,
    lean: mix(a.lean, b.lean),
    armBack: limb(a.armBack, b.armBack),
    armFront: limb(a.armFront, b.armFront),
    legBack: limb(a.legBack, b.legBack),
    legFront: limb(a.legFront, b.legFront),
    tilt: mix(a.tilt ?? 0, b.tilt ?? 0),
  };
}

const WALK_KEYS: Pose[] = [
  {
    lean: 4,
    armBack: [22, 18],
    armFront: [-18, 10],
    legBack: [-26, -8],
    legFront: [28, -4],
    tilt: 2,
  },
  {
    lean: 6,
    armBack: [14, 15],
    armFront: [-10, 10],
    legBack: [-22, -40],
    legFront: [18, -14],
    tilt: 3,
  },
  { lean: 5, armBack: [2, 10], armFront: [0, 8], legBack: [12, -60], legFront: [2, -2], tilt: 2 },
  {
    lean: 4,
    armBack: [-10, 10],
    armFront: [12, 12],
    legBack: [30, -30],
    legFront: [-12, -2],
    tilt: 1,
  },
];

function mirrored(pose: Pose): Pose {
  return {
    ...pose,
    armBack: pose.armFront,
    armFront: pose.armBack,
    legBack: pose.legFront,
    legFront: pose.legBack,
  };
}

export function walkCycle(frames: number): Pose[] {
  const keys = [...WALK_KEYS, ...WALK_KEYS.map(mirrored)];
  const count = Math.max(keys.length, frames);

  return Array.from({ length: count }, (_, i) => {
    const at = (i / count) * keys.length;
    const k = Math.floor(at);
    const a = keys[k % keys.length] ?? poses.stand;
    const b = keys[(k + 1) % keys.length] ?? poses.stand;

    return lerpPose(a, b, at - k);
  });
}
