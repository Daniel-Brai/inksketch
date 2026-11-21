import type { BodyType, Hair, LeafOptions, Outfit, Prop, TreeOptions } from '#/figures/types.ts';
import type { Shade } from '#/fills.ts';
import type { FontRole, LetteringMode } from '#/style.ts';
import type { SwarmMotion, SwarmOptions } from '#/swarm.types.ts';

import type { FieldDef } from './document.types.ts';

export type FillName = 'none' | 'paper' | 'solid' | 'hatch' | 'crosshatch' | 'stipple' | 'wash';
export type PropName = 'none' | Prop;

export const FILLS: readonly FillName[] = [
  'none',
  'paper',
  'solid',
  'hatch',
  'crosshatch',
  'stipple',
  'wash',
];

export const SHADES: readonly Shade[] = ['none', 'hatch', 'crosshatch', 'stipple', 'solid'];
export const LOOKS: ReadonlyArray<'solid' | 'outline' | 'ghost'> = ['solid', 'outline', 'ghost'];
export const BODY_TYPES: readonly BodyType[] = ['neutral', 'masculine', 'feminine', 'child'];
export const OUTFITS: readonly Outfit[] = ['trousers', 'skirt', 'dress', 'coat'];
export const HAIRS: readonly Hair[] = ['none', 'short', 'long', 'bun', 'ponytail'];

export const PROPS: readonly PropName[] = [
  'none',
  'sign',
  'briefcase',
  'phone',
  'umbrella',
  'ball',
];

export const RENDERINGS: ReadonlyArray<'drawn' | 'mechanical'> = ['drawn', 'mechanical'];
export const FACINGS: ReadonlyArray<'right' | 'left'> = ['right', 'left'];
export const YES_NO: ReadonlyArray<'yes' | 'no'> = ['yes', 'no'];
export const LETTERINGS: readonly LetteringMode[] = ['hand', 'font'];
export const FONT_ROLES: readonly FontRole[] = ['hand', 'sans', 'mono', 'serif'];

export const LEAVES: ReadonlyArray<NonNullable<TreeOptions['leaves']>> = [
  'none',
  'dots',
  'loops',
  'leaves',
  'blossoms',
];

export const LEAF_SHADES: ReadonlyArray<NonNullable<LeafOptions['shade']>> = [
  'contour',
  'hatch',
  'none',
];

export const SWARM_SHAPES: ReadonlyArray<'ring' | 'disk' | 'rect'> = ['ring', 'disk', 'rect'];

export const SWARM_KINDS: ReadonlyArray<NonNullable<SwarmOptions['kind']>> = [
  'dot',
  'figure',
  'mix',
];

export const SWARM_MOTIONS: readonly SwarmMotion[] = [
  'drift',
  'orbit',
  'breathe',
  'shimmer',
  'none',
];

export const ARROW_ENDS: ReadonlyArray<'open' | 'filled' | 'none' | 'dot'> = [
  'open',
  'filled',
  'none',
  'dot',
];

export const num = (
  key: string,
  label: string,
  range: readonly [number, number, number],
): FieldDef => ({
  key,
  label,
  type: 'number',
  min: range[0],
  max: range[1],
  step: range[2],
});

export const pick = (key: string, label: string, options: readonly string[]): FieldDef => ({
  key,
  label,
  type: 'choice',
  options,
});

export const INK_FIELDS: FieldDef[] = [
  { key: 'color', label: 'Color', type: 'color' },
  num('width', 'Line width', [0.3, 12, 0.1]),
  num('roughness', 'Roughness', [0, 4, 0.1]),
  num('pressure', 'Pressure', [0, 1, 0.05]),
];

export const FILL_FIELD: FieldDef = pick('fill', 'Fill', FILLS);
