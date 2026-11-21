import type { FillSpec, Shade } from '#/fills.ts';
import type { Point } from '#/geometry.ts';
import type { Ink } from '#/options.ts';

import type { Pose, PoseName } from './poses.ts';

export interface StickFigureOptions extends Ink {
  height?: number | undefined;
  pose?: PoseName | Pose | undefined;
  facing?: 1 | -1 | undefined;
  solidHead?: boolean | undefined;
}

export interface WalkerOptions extends PersonOptions {
  arms?: PoseName | Pose | undefined;
  route?: readonly Point[] | undefined;
  speed?: number | undefined;
  fps?: number | undefined;
  distance?: number | undefined;
  durationMs?: number | undefined;
}

export interface StoneOptions extends Ink {
  shade?: Shade;
  squash?: number;
  lightDeg?: number;
}

export interface CylinderOptions extends Ink {
  rx?: number;
  ry?: number;
  height?: number;
  rings?: number;
  shade?: Shade;
  label?: string;
  labelSize?: number;
}

export interface CubeOptions extends Ink {
  depth?: number;
  angleDeg?: number;
  shade?: Shade;
  label?: string;
  labelSize?: number;
}

export interface DocumentOptions extends Ink {
  fold?: number;
  lines?: number;
  title?: string;
}

export interface CloudOptions extends Ink {
  bumps?: number;
  label?: string;
  labelSize?: number;
}

export interface ServerOptions extends Ink {
  units?: number;
  label?: string;
}

export interface LightbulbOptions extends Ink {
  rays?: boolean;
  filament?: boolean;
}

export interface GearOptions extends Ink {
  teeth?: number;
  toothDepth?: number;
  hole?: number;
}

export interface TreeOptions extends Ink {
  depth?: number;
  spreadDeg?: number;
  ratio?: number;
  trunk?: number;
  leaves?: 'none' | 'dots' | 'loops' | 'leaves' | 'blossoms';
  directionDeg?: number;
  seed?: number | string;
}

export interface LeafOptions extends Ink {
  angleDeg?: number;
  widthRatio?: number;
  veins?: boolean;
  shade?: 'contour' | 'hatch' | 'none';
}

export interface PlantOptions extends Ink {
  leaves?: number;
  pot?: boolean;
  potSize?: readonly [number, number];
  swayDeg?: number;
}

export interface PotOptions extends Ink {
  soil?: boolean;
  shade?: Shade;
}

export interface SunOptions extends Ink {
  rays?: number;
  rayLength?: number;
}

export interface WavesOptions extends Ink {
  amplitude?: number;
  wavelength?: number;
  rows?: number;
  rowGap?: number;
}

export interface ScribbleOptions extends Ink {
  turns?: number;
}

export interface GraphNode {
  id: string;
  at: readonly [number, number];
  r?: number;
  label?: string;
  shape?: 'circle' | 'box' | 'dot';
  fill?: FillSpec;
}

export interface GraphEdgeSpec {
  from: string;
  to: string;
  bend?: number;
  dashed?: boolean;
  label?: string;
  head?: 'open' | 'filled' | 'none';
}

export type GraphEdge = readonly [string, string] | GraphEdgeSpec;

export interface GraphOptions extends Ink {
  r?: number;
  arrows?: boolean;
  labelSize?: number;
  gap?: number;
}

export interface PebblesOptions extends Ink {
  count?: number;
  minR?: number;
  maxR?: number;
  shade?: Shade;
}

export interface CracksOptions extends Ink {
  cells?: number;
  gap?: number;
  shadeShare?: number;
}

export interface GrassOptions extends Ink {
  density?: number;
  height?: number;
  leanDeg?: number;
}

export interface LogEndOptions extends Ink {
  rings?: number;
  splits?: number;
}

export interface PersonOptions extends Ink {
  height?: number | undefined;
  pose?: PoseName | Pose | undefined;
  facing?: 1 | -1 | undefined;
  look?: 'outline' | 'solid' | 'ghost' | undefined;
  rendering?: 'drawn' | 'mechanical' | undefined;
  build?: number | undefined;
  body?: BodyType | undefined;
  outfit?: Outfit | undefined;
  hair?: Hair | undefined;
  prop?: Prop | undefined;
  propText?: string | undefined;
}

export type Prop = 'sign' | 'briefcase' | 'phone' | 'umbrella' | 'ball';

export type BodyType = 'neutral' | 'masculine' | 'feminine' | 'child';
export type Outfit = 'trousers' | 'skirt' | 'dress' | 'coat';
export type Hair = 'none' | 'short' | 'long' | 'bun' | 'ponytail';

export interface BonsaiOptions extends Ink {
  pads?: number;
  potWidth?: number;
  breezeDeg?: number;
  seed?: number | string;
}
