import type { FillSpec } from './fills.ts';
import type { Point, Size } from './geometry.ts';
import type { Transform } from './model.ts';
import type { Color, FontRole, LetteringMode, Palette, Preset, PresetName } from './style.ts';

export interface Ink {
  color?: Color | undefined;
  width?: number | undefined;
  opacity?: number | undefined;
  dashed?: boolean | number | number[] | undefined;
  stroke?: boolean | undefined;
  fill?: FillSpec | undefined;
  roughness?: number | undefined;
  bowing?: number | undefined;
  overshoot?: number | undefined;
  draw?: boolean | undefined;
  cap?: 'round' | 'butt' | 'square' | undefined;
  pressure?: number | undefined;
}

export interface TextOptions {
  size?: number | undefined;
  anchor?: 'start' | 'middle' | 'end' | undefined;
  lettering?: LetteringMode | undefined;
  font?: FontRole | (string & {}) | undefined;
  weight?: number | undefined;
  color?: Color | undefined;
  opacity?: number | undefined;
  rotateDeg?: number | undefined;
  slantDeg?: number | undefined;
  width?: number | undefined;
  roughness?: number | undefined;
  lineHeight?: number | undefined;
  tracking?: number | undefined;
  draw?: boolean | undefined;
}

export type ArrowEnd = 'open' | 'filled' | 'none' | 'dot';

export interface ArrowOptions extends Ink {
  bend?: number;
  head?: ArrowEnd;
  tail?: ArrowEnd;
  headSize?: number;
  inset?: number | [number, number];
}

export interface ArcOptions extends Ink {
  fromDeg: number;
  toDeg: number;
}

export interface BlobOptions extends Ink {
  irregularity?: number;
  flatBottom?: number;
  rotateDeg?: number;
}

export interface BraceOptions extends Ink {
  depth?: number;
}

export interface DotOptions {
  size?: number | undefined;
  color?: Color | undefined;
  opacity?: number | undefined;
  draw?: boolean | undefined;
}

export type GroupOptions = Transform;

export interface FrameOptions {
  fps?: number;
  delayMs?: number;
  once?: boolean;
}

export interface PathOptions extends Ink {
  at?: Point;
  scale?: number;
  tolerance?: number;
}

export interface TraceOptions extends Ink {
  at?: Point;
  size?: Size;
  filled?: FillSpec;
}

export interface ContourHatchOptions extends Ink {
  length?: number;
  lengthEnd?: number;
  gap?: number;
  side?: 1 | -1;
  tiltDeg?: number;
  taper?: boolean;
}

export interface ToneStippleOptions extends Ink {
  density?: number;
  size?: number;
}

export interface ToneHatchOptions extends Ink {
  layers?: number;
  gap?: number;
  angleDeg?: number;
}

export interface TaperOptions extends Ink {
  shade?: 'left' | 'right' | 'none';
  hatchGap?: number;
}

export interface MorphOptions extends Ink {
  frames?: number;
  fps?: number;
  closed?: boolean;
  pingpong?: boolean;
}

export interface DrawConfig {
  speed?: number;
  gapMs?: number;
  delayMs?: number;
  maxDurationMs?: number;
  loop?: boolean;
  holdMs?: number;
  easing?: string;
}

export interface SketchOptions {
  width: number;
  height: number;
  style?: PresetName | Partial<Preset>;
  palette?: { light?: Partial<Palette>; dark?: Partial<Palette> };
  seed?: number | string;
  background?: 'none' | Color;
  texture?: boolean | number;
  vignette?: boolean | number;
  title?: string;
  description?: string;
  draw?: boolean | DrawConfig;
  boil?: boolean | { frames?: number; fps?: number };
}

export type AnchorSide =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';
