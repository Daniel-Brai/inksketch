import type { Ink } from '#/options.ts';
import type { Sketch } from '#/sketch.ts';

export function scaledWidth(s: Sketch, ink: Ink, factor: number): number {
  return (ink.width ?? s.preset.strokeWidth) * factor;
}

export function scaledRoughness(s: Sketch, ink: Ink, factor: number): number {
  return (ink.roughness ?? s.preset.roughness) * factor;
}
