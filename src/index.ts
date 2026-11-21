export { sketch } from './create.ts';
export { Sketch } from './sketch.ts';
export { Shape } from './shape.ts';
export { renderSketch } from './render.ts';
export { motion, motions } from './motion.ts';
export { presets, resolvePreset, FONT_STACKS } from './style.ts';
export { poses, lerpPose } from './figures/poses.ts';
export { createRng, lineNoise } from './random.ts';
export { parsePath } from './svgpath.ts';
export { readSVG } from './svg-import.ts';
export { supportedCharacters } from './lettering.ts';
export type * from './options.ts';
export type * from './render.types.ts';
export type * from './figures/types.ts';
export type * from './swarm.types.ts';
export type { MotionOptions } from './motion.ts';

export type {
  Preset,
  PresetName,
  Palette,
  Color,
  ColorName,
  ThemedColor,
  FontRole,
} from './style.ts';

export type { Pose, PoseName, Limb } from './figures/poses.ts';

export type {
  FillSpec,
  HatchFill,
  StippleFill,
  SolidFill,
  WashFill,
  Shade,
  ShadeSpec,
} from './fills.ts';

export { tones } from './tone.ts';
export type { ToneField, PixelGrid, ShadeFrom } from './tone.ts';
export type { Motion, MotionFrame, DrawControl, Transform } from './model.ts';

export {
  add,
  bentLine,
  dist,
  ellipsePoints,
  lerp,
  mul,
  normal,
  rotate,
  spline,
  sub,
  taperedOutline,
} from './geometry.ts';

export type { Point, Size, Box } from './geometry.ts';
export type { Rng } from './random.ts';
