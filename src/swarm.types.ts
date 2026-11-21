import type { Point } from './geometry.ts';
import type { Color } from './style.ts';

export type SwarmShape =
  | { type: 'ring'; center: Point; r: number; width?: number }
  | { type: 'disk'; center: Point; r: number; falloff?: number }
  | { type: 'rect'; at: Point; size: readonly [number, number] }
  | { type: 'line'; from: Point; to: Point; spread?: number }
  | { type: 'points'; points: Point[]; spread?: number };

export type SwarmMotion = 'none' | 'drift' | 'orbit' | 'breathe' | 'shimmer';

export interface SwarmOptions {
  shape: SwarmShape;
  count: number;
  kind?: 'dot' | 'figure' | 'mix' | undefined;
  size?: number | undefined;
  sizeJitter?: number | undefined;
  perspective?: boolean | undefined;
  motion?: SwarmMotion | undefined;
  speed?: number | undefined;
  groups?: number | undefined;
  color?: Color | undefined;
  opacity?: number | undefined;
  appearAtMs?: number | undefined;
  seed?: number | string | undefined;
}
