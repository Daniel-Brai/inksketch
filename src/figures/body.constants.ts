import type { BodyType } from './types.ts';

export interface BodyBuild {
  shoulders: number;
  waist: number;
  hips: number;
  thigh: number;
  arm: number;
  head: number;
  limbs: number;
}

export const BODIES: Record<BodyType, BodyBuild> = {
  neutral: { shoulders: 1, waist: 1, hips: 1, thigh: 1, arm: 1, head: 1, limbs: 1 },
  masculine: {
    shoulders: 1.16,
    waist: 1.02,
    hips: 0.92,
    thigh: 1.02,
    arm: 1.12,
    head: 1,
    limbs: 1.02,
  },
  feminine: {
    shoulders: 0.86,
    waist: 0.8,
    hips: 1.2,
    thigh: 1.08,
    arm: 0.86,
    head: 0.97,
    limbs: 1,
  },
  child: {
    shoulders: 0.92,
    waist: 1.05,
    hips: 0.95,
    thigh: 0.95,
    arm: 0.95,
    head: 1.45,
    limbs: 0.84,
  },
};

export const SILHOUETTE_CACHE_LIMIT = 256;
