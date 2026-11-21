import type { Pose } from '#/figures/poses.ts';
import type { Point } from '#/geometry.ts';
import type { Palette, PresetName, ThemedColor } from '#/style.ts';

export type PropValue = number | string | boolean | Point | ThemedColor | Pose | null;

export interface Keyframe<T> {
  atMs: number;
  value: T;
  easing?: string;
}

export type Track<T> = Keyframe<T>[];

export interface TransformTracks {
  x?: Track<number>;
  y?: Track<number>;
  rotate?: Track<number>;
  scale?: Track<number>;
  opacity?: Track<number>;
}

export interface ElementDoc {
  id: string;
  name: string;
  component: string;
  props: Record<string, PropValue>;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  style: PresetName | null;
  draw: { startMs: number; durationMs: number } | null;
  visible: { fromMs: number; toMs: number | null };
  tracks: TransformTracks;
  propTracks: Record<string, Track<PropValue>>;
  motion: { preset: string; options: Record<string, number> } | null;
  hidden: boolean;
  locked: boolean;
  children: ElementDoc[];
}

export interface SceneDoc {
  id: string;
  name: string;
  durationMs: number;
  fps: number;
  background: 'none' | 'paper' | string;
  texture: number;
  vignette: number;
  seed: string;
  style: PresetName;
  transition: { kind: 'cut' | 'fade'; durationMs: number };
  elements: ElementDoc[];
}

export interface ProjectDoc {
  version: 1;
  id: string;
  title: string;
  width: number;
  height: number;
  palette: { light?: Partial<Palette>; dark?: Partial<Palette> };
  scenes: SceneDoc[];
}

export type FieldDef =
  | { key: string; label: string; type: 'number'; min: number; max: number; step: number }
  | { key: string; label: string; type: 'text' | 'longtext' | 'svg' | 'path' }
  | { key: string; label: string; type: 'boolean' | 'color' | 'point' | 'pose' }
  | { key: string; label: string; type: 'choice'; options: readonly string[] };

export type ComponentCategory =
  | 'shapes'
  | 'lines'
  | 'text'
  | 'people'
  | 'objects'
  | 'nature'
  | 'textures'
  | 'crowds'
  | 'diagrams'
  | 'import';
