import type { SketchOptions } from './options.ts';
import { Sketch } from './sketch.ts';

export function sketch(options: SketchOptions): Sketch {
  return new Sketch(options);
}
