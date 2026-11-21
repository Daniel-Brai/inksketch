import type { RenderOptions } from '#/render.types.ts';

export interface SceneRenderOptions {
  theme: NonNullable<RenderOptions['theme']>;
  trigger: NonNullable<RenderOptions['trigger']>;
  static: boolean;
}

export interface RenderResult {
  file: string;
  svg: string;
  ms: number;
}

export interface RenderFailure {
  file: string;
  error: string;
}

export type RenderOutcome = RenderResult | RenderFailure;
