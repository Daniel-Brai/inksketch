import type { KeyframeRegistry } from './keyframes.ts';

export interface EmbeddedFont {
  family: string;
  src: string;
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype';
  weight?: string;
  style?: string;
}

export interface RenderOptions {
  theme?: 'light' | 'dark' | 'auto' | 'inherit';
  trigger?: 'load' | 'visible' | 'hover' | 'click';
  replay?: boolean;
  id?: string;
  fonts?: EmbeddedFont[];
  responsive?: boolean;
  static?: boolean;
  darkSelector?: string;
  time?: number;
  lightSelector?: string;
}

export interface Timeline {
  times: Map<number, [number, number]>;
  ends: Map<number, number>;
  total: number;
}

export interface LoopTiming {
  cycle: number;
  hold: number;
}

export interface RenderContext {
  seed: number | string;
  frame: number;
  animate: boolean;
  still: boolean;
  timeline: Timeline;
  keyframes: KeyframeRegistry;
  loop: LoopTiming | null;
  easing: string;
  time: number | null;
  sid: string;
}
