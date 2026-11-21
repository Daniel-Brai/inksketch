import type { SketchOptions } from './options.ts';

const MAX_SIDE = 20000;

export function assertSize(options: SketchOptions): void {
  const ok = (v: number): boolean => Number.isFinite(v) && v > 0 && v <= MAX_SIDE;

  if (!ok(options.width) || !ok(options.height)) {
    throw new Error(
      `inksketch: width and height must be between 1 and ${MAX_SIDE}, got ${options.width}×${options.height}`,
    );
  }
}
