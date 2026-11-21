import { poses, type Pose, type PoseName } from '#/figures/poses.ts';
import type { Point } from '#/geometry.ts';
import type { Ink } from '#/options.ts';
import type { Sketch } from '#/sketch.ts';
import type { SwarmShape } from '#/swarm.types.ts';

import type { ComponentCategory, FieldDef, PropValue } from './document.types.ts';
import {
  ARROW_ENDS,
  BODY_TYPES,
  FACINGS,
  FILL_FIELD,
  FILLS,
  FONT_ROLES,
  HAIRS,
  INK_FIELDS,
  LEAF_SHADES,
  LEAVES,
  LETTERINGS,
  LOOKS,
  num,
  OUTFITS,
  pick,
  PROPS,
  RENDERINGS,
  SHADES,
  SWARM_KINDS,
  SWARM_MOTIONS,
  SWARM_SHAPES,
  YES_NO,
} from './fields.ts';
import { Props } from './props.ts';

export interface ComponentDef {
  id: string;
  label: string;
  category: ComponentCategory;
  fields: FieldDef[];
  defaults: Record<string, PropValue>;
  build: (s: Sketch, p: Props) => void;
}

function ink(p: Props): Ink {
  const ink: Ink = { color: p.color('color'), fill: p.choice('fill', FILLS, 'none') };
  const width = p.number('width', -1);
  const roughness = p.number('roughness', -1);
  const pressure = p.number('pressure', 0);

  if (width > 0) ink.width = width;

  if (roughness >= 0) ink.roughness = roughness;

  if (pressure > 0) ink.pressure = pressure;

  return ink;
}

function poseOf(p: Props): Pose | PoseName {
  return p.pose('pose');
}

const SIZE: FieldDef[] = [num('w', 'Width', [4, 2000, 1]), num('h', 'Height', [4, 2000, 1])];
const RADIUS: FieldDef = num('r', 'Radius', [2, 800, 1]);
const LABEL: FieldDef = { key: 'label', label: 'Label', type: 'text' };

const PERSON_FIELDS: FieldDef[] = [
  num('height', 'Height', [20, 800, 1]),
  { key: 'pose', label: 'Pose', type: 'pose' },
  pick('look', 'Look', LOOKS),
  pick('body', 'Body', BODY_TYPES),
  pick('outfit', 'Outfit', OUTFITS),
  pick('hair', 'Hair', HAIRS),
  pick('prop', 'Holding', PROPS),
  { key: 'propText', label: 'Sign text', type: 'text' },
  pick('facing', 'Facing', FACINGS),
  pick('rendering', 'Rendering', RENDERINGS),
  { key: 'color', label: 'Color', type: 'color' },
];

function personOptions(p: Props): Parameters<Sketch['person']>[1] {
  const prop = p.choice('prop', PROPS, 'none');

  const options: NonNullable<Parameters<Sketch['person']>[1]> = {
    height: p.number('height', 120),
    pose: poseOf(p),
    look: p.choice('look', LOOKS, 'solid'),
    body: p.choice('body', BODY_TYPES, 'neutral'),
    outfit: p.choice('outfit', OUTFITS, 'trousers'),
    hair: p.choice('hair', HAIRS, 'none'),
    facing: p.choice('facing', FACINGS, 'right') === 'left' ? -1 : 1,
    rendering: p.choice('rendering', RENDERINGS, 'drawn'),
    color: p.color('color'),
    propText: p.text('propText', 'hello'),
  };

  if (prop !== 'none') options.prop = prop;

  return options;
}

const ORIGIN: Point = [0, 0];

function swarmShape(kind: 'ring' | 'disk' | 'rect', r: number): SwarmShape {
  if (kind === 'rect') return { type: 'rect', at: [-r, -r * 0.5], size: [r * 2, r] };

  return { type: kind, center: ORIGIN, r };
}

export const COMPONENTS: ComponentDef[] = [
  {
    id: 'rect',
    label: 'Rectangle',
    category: 'shapes',
    fields: [...SIZE, num('radius', 'Corner radius', [0, 200, 1]), FILL_FIELD, ...INK_FIELDS],
    defaults: { w: 160, h: 100, radius: 0, fill: 'none' },
    build: (s, p) =>
      s.rect(
        [-p.number('w', 160) / 2, -p.number('h', 100) / 2],
        [p.number('w', 160), p.number('h', 100)],
        { ...ink(p), radius: p.number('radius', 0) },
      ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    category: 'shapes',
    fields: [...SIZE, FILL_FIELD, ...INK_FIELDS],
    defaults: { w: 140, h: 100, fill: 'none' },
    build: (s, p) => s.ellipse(ORIGIN, [p.number('w', 140) / 2, p.number('h', 100) / 2], ink(p)),
  },
  {
    id: 'blob',
    label: 'Blob',
    category: 'shapes',
    fields: [
      ...SIZE,
      num('irregularity', 'Irregularity', [0, 0.8, 0.01]),
      FILL_FIELD,
      ...INK_FIELDS,
    ],
    defaults: { w: 140, h: 100, irregularity: 0.2, fill: 'none' },
    build: (s, p) =>
      s.blob(ORIGIN, [p.number('w', 140) / 2, p.number('h', 100) / 2], {
        ...ink(p),
        irregularity: p.number('irregularity', 0.2),
      }),
  },
  {
    id: 'line',
    label: 'Line',
    category: 'lines',
    fields: [
      { key: 'to', label: 'End', type: 'point' },
      pick('dashed', 'Dashed', YES_NO),
      ...INK_FIELDS,
    ],
    defaults: { to: [160, 0], dashed: 'no' },
    build: (s, p) =>
      s.line(ORIGIN, p.point('to', [160, 0]), {
        ...ink(p),
        dashed: p.choice('dashed', YES_NO, 'no') === 'yes',
      }),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    category: 'lines',
    fields: [
      { key: 'to', label: 'End', type: 'point' },
      num('bend', 'Bend', [-1, 1, 0.01]),
      pick('head', 'Head', ARROW_ENDS),
      pick('tail', 'Tail', ARROW_ENDS),
      ...INK_FIELDS,
    ],
    defaults: { to: [180, 0], bend: 0.15, head: 'open', tail: 'none' },
    build: (s, p) =>
      s.arrow(ORIGIN, p.point('to', [180, 0]), {
        ...ink(p),
        bend: p.number('bend', 0.15),
        head: p.choice('head', ARROW_ENDS, 'open'),
        tail: p.choice('tail', ARROW_ENDS, 'none'),
      }),
  },
  {
    id: 'brace',
    label: 'Curly brace',
    category: 'lines',
    fields: [
      { key: 'to', label: 'End', type: 'point' },
      num('depth', 'Depth', [2, 80, 1]),
      ...INK_FIELDS,
    ],
    defaults: { to: [0, 120], depth: 14 },
    build: (s, p) =>
      s.brace(ORIGIN, p.point('to', [0, 120]), { ...ink(p), depth: p.number('depth', 14) }),
  },
  {
    id: 'path',
    label: 'SVG path',
    category: 'import',
    fields: [
      { key: 'd', label: 'Path data', type: 'path' },
      num('scale', 'Scale', [0.05, 20, 0.05]),
      FILL_FIELD,
      ...INK_FIELDS,
    ],
    defaults: { d: 'M0 0 C 40 -60 120 -60 160 0', scale: 1, fill: 'none' },
    build: (s, p) => s.path(p.text('d', 'M0 0 L100 0'), { ...ink(p), scale: p.number('scale', 1) }),
  },
  {
    id: 'svg',
    label: 'Trace SVG',
    category: 'import',
    fields: [{ key: 'svg', label: 'SVG markup', type: 'svg' }, ...SIZE, FILL_FIELD, ...INK_FIELDS],
    defaults: {
      svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>',
      w: 120,
      h: 120,
      fill: 'solid',
    },
    build: (s, p) => {
      const w = p.number('w', 120);
      const h = p.number('h', 120);

      s.trace(p.text('svg', '<svg/>'), {
        ...ink(p),
        at: [-w / 2, -h / 2],
        size: [w, h],
        filled: p.choice('fill', FILLS, 'solid'),
      });
    },
  },
  {
    id: 'text',
    label: 'Hand lettering',
    category: 'text',
    fields: [
      { key: 'text', label: 'Text', type: 'longtext' },
      num('size', 'Size', [6, 200, 1]),
      pick('lettering', 'Lettering', LETTERINGS),
      pick('font', 'Font', FONT_ROLES),
      { key: 'color', label: 'Color', type: 'color' },
    ],
    defaults: { text: 'an idea', size: 22, lettering: 'hand', font: 'hand' },
    build: (s, p) =>
      s.label(ORIGIN, p.text('text', ''), {
        size: p.number('size', 22),
        lettering: p.choice('lettering', LETTERINGS, 'hand'),
        font: p.choice('font', FONT_ROLES, 'hand'),
        color: p.color('color'),
      }),
  },
  {
    id: 'person',
    label: 'Person',
    category: 'people',
    fields: PERSON_FIELDS,
    defaults: {
      height: 140,
      pose: 'stand',
      look: 'outline',
      body: 'neutral',
      outfit: 'trousers',
      hair: 'none',
      prop: 'none',
      facing: 'right',
      rendering: 'drawn',
    },
    build: (s, p) => s.person(ORIGIN, personOptions(p)),
  },
  {
    id: 'walker',
    label: 'Walking person',
    category: 'people',
    fields: [
      ...PERSON_FIELDS.filter((f) => f.key !== 'pose'),
      num('distance', 'Walk distance', [-2000, 2000, 1]),
      num('durationMs', 'Walk time (ms)', [500, 60000, 100]),
    ],
    defaults: {
      height: 140,
      look: 'outline',
      body: 'neutral',
      outfit: 'trousers',
      hair: 'none',
      prop: 'none',
      facing: 'right',
      rendering: 'drawn',
      distance: 0,
      durationMs: 6000,
    },
    build: (s, p) =>
      s.walker(ORIGIN, {
        ...personOptions(p),
        distance: p.number('distance', 0),
        durationMs: p.number('durationMs', 6000),
      }),
  },
  {
    id: 'stickFigure',
    label: 'Stick figure',
    category: 'people',
    fields: [
      num('height', 'Height', [10, 600, 1]),
      { key: 'pose', label: 'Pose', type: 'pose' },
      pick('facing', 'Facing', FACINGS),
      ...INK_FIELDS,
    ],
    defaults: { height: 80, pose: 'stand', facing: 'right' },
    build: (s, p) =>
      s.stickFigure(ORIGIN, {
        ...ink(p),
        height: p.number('height', 80),
        pose: poseOf(p),
        facing: p.choice('facing', FACINGS, 'right') === 'left' ? -1 : 1,
      }),
  },
  {
    id: 'stone',
    label: 'Stone',
    category: 'objects',
    fields: [RADIUS, pick('shade', 'Shade', SHADES), ...INK_FIELDS],
    defaults: { r: 40, shade: 'stipple' },
    build: (s, p) =>
      s.stone(ORIGIN, p.number('r', 40), {
        ...ink(p),
        shade: p.choice('shade', SHADES, 'stipple'),
      }),
  },
  {
    id: 'cylinder',
    label: 'Database',
    category: 'objects',
    fields: [
      num('rx', 'Radius', [8, 400, 1]),
      num('height', 'Height', [8, 800, 1]),
      num('rings', 'Rings', [0, 8, 1]),
      pick('shade', 'Shade', SHADES),
      LABEL,
      ...INK_FIELDS,
    ],
    defaults: { rx: 60, height: 110, rings: 2, shade: 'none', label: 'data' },
    build: (s, p) =>
      s.cylinder(ORIGIN, {
        ...ink(p),
        rx: p.number('rx', 60),
        height: p.number('height', 110),
        rings: p.number('rings', 2),
        shade: p.choice('shade', SHADES, 'none'),
        label: p.text('label', ''),
      }),
  },
  {
    id: 'cube',
    label: 'Box',
    category: 'objects',
    fields: [
      num('size', 'Size', [8, 600, 1]),
      pick('shade', 'Shade', SHADES),
      LABEL,
      ...INK_FIELDS,
    ],
    defaults: { size: 100, shade: 'hatch', label: '' },
    build: (s, p) =>
      s.cube([-p.number('size', 100) / 2, -p.number('size', 100) / 2], p.number('size', 100), {
        ...ink(p),
        shade: p.choice('shade', SHADES, 'hatch'),
        label: p.text('label', ''),
      }),
  },
  {
    id: 'document',
    label: 'Document',
    category: 'objects',
    fields: [
      ...SIZE,
      num('lines', 'Lines', [0, 20, 1]),
      { key: 'title', label: 'Title', type: 'text' },
      ...INK_FIELDS,
    ],
    defaults: { w: 90, h: 120, lines: 5, title: '' },
    build: (s, p) =>
      s.document(
        [-p.number('w', 90) / 2, -p.number('h', 120) / 2],
        [p.number('w', 90), p.number('h', 120)],
        { ...ink(p), lines: p.number('lines', 5), title: p.text('title', '') },
      ),
  },
  {
    id: 'cloud',
    label: 'Cloud',
    category: 'objects',
    fields: [...SIZE, num('bumps', 'Bumps', [3, 16, 1]), LABEL, ...INK_FIELDS],
    defaults: { w: 180, h: 90, bumps: 7, label: '' },
    build: (s, p) =>
      s.cloud(ORIGIN, [p.number('w', 180), p.number('h', 90)], {
        ...ink(p),
        bumps: p.number('bumps', 7),
        label: p.text('label', ''),
      }),
  },
  {
    id: 'server',
    label: 'Server',
    category: 'objects',
    fields: [...SIZE, num('units', 'Units', [1, 10, 1]), LABEL, ...INK_FIELDS],
    defaults: { w: 70, h: 100, units: 3, label: '' },
    build: (s, p) =>
      s.server(
        [-p.number('w', 70) / 2, -p.number('h', 100) / 2],
        [p.number('w', 70), p.number('h', 100)],
        { ...ink(p), units: p.number('units', 3), label: p.text('label', '') },
      ),
  },
  {
    id: 'lightbulb',
    label: 'Light bulb',
    category: 'objects',
    fields: [RADIUS, pick('rays', 'Rays', YES_NO), ...INK_FIELDS],
    defaults: { r: 30, rays: 'yes' },
    build: (s, p) =>
      s.lightbulb(ORIGIN, p.number('r', 30), {
        ...ink(p),
        rays: p.choice('rays', YES_NO, 'yes') === 'yes',
      }),
  },
  {
    id: 'gear',
    label: 'Gear',
    category: 'objects',
    fields: [RADIUS, num('teeth', 'Teeth', [4, 40, 1]), ...INK_FIELDS],
    defaults: { r: 40, teeth: 10 },
    build: (s, p) => s.gear(ORIGIN, p.number('r', 40), { ...ink(p), teeth: p.number('teeth', 10) }),
  },
  {
    id: 'tree',
    label: 'Tree',
    category: 'nature',
    fields: [
      num('height', 'Height', [20, 900, 1]),
      num('depth', 'Branching', [2, 9, 1]),
      num('spreadDeg', 'Spread', [5, 60, 1]),
      pick('leaves', 'Leaves', LEAVES),
      ...INK_FIELDS,
    ],
    defaults: { height: 220, depth: 7, spreadDeg: 26, leaves: 'none' },
    build: (s, p) =>
      s.tree(ORIGIN, p.number('height', 220), {
        ...ink(p),
        depth: p.number('depth', 7),
        spreadDeg: p.number('spreadDeg', 26),
        leaves: p.choice('leaves', LEAVES, 'none'),
      }),
  },
  {
    id: 'roots',
    label: 'Roots',
    category: 'nature',
    fields: [num('length', 'Length', [10, 600, 1]), ...INK_FIELDS],
    defaults: { length: 120 },
    build: (s, p) => s.roots(ORIGIN, p.number('length', 120), ink(p)),
  },
  {
    id: 'plant',
    label: 'Potted plant',
    category: 'nature',
    fields: [
      num('height', 'Height', [20, 600, 1]),
      num('leaves', 'Leaves', [1, 12, 1]),
      pick('pot', 'Pot', YES_NO),
      ...INK_FIELDS,
    ],
    defaults: { height: 120, leaves: 5, pot: 'yes' },
    build: (s, p) =>
      s.plant(ORIGIN, p.number('height', 120), {
        ...ink(p),
        leaves: p.number('leaves', 5),
        pot: p.choice('pot', YES_NO, 'yes') === 'yes',
      }),
  },
  {
    id: 'leaf',
    label: 'Leaf',
    category: 'nature',
    fields: [
      num('length', 'Length', [6, 400, 1]),
      num('angleDeg', 'Angle', [-180, 180, 1]),
      pick('shade', 'Shade', LEAF_SHADES),
      ...INK_FIELDS,
    ],
    defaults: { length: 60, angleDeg: 0, shade: 'contour' },
    build: (s, p) =>
      s.leaf(ORIGIN, p.number('length', 60), {
        ...ink(p),
        angleDeg: p.number('angleDeg', 0),
        shade: p.choice('shade', LEAF_SHADES, 'contour'),
      }),
  },
  {
    id: 'sun',
    label: 'Sun',
    category: 'nature',
    fields: [RADIUS, num('rays', 'Rays', [0, 32, 1]), ...INK_FIELDS],
    defaults: { r: 26, rays: 10 },
    build: (s, p) => s.sun(ORIGIN, p.number('r', 26), { ...ink(p), rays: p.number('rays', 10) }),
  },
  {
    id: 'waves',
    label: 'Waves',
    category: 'nature',
    fields: [
      num('width', 'Width', [10, 2000, 1]),
      num('rows', 'Rows', [1, 20, 1]),
      num('amplitude', 'Amplitude', [1, 60, 1]),
      num('wavelength', 'Wavelength', [6, 300, 1]),
      { key: 'color', label: 'Color', type: 'color' },
    ],
    defaults: { width: 240, rows: 3, amplitude: 5, wavelength: 36 },
    build: (s, p) =>
      s.waves([-p.number('width', 240) / 2, 0], p.number('width', 240), {
        color: p.color('color'),
        rows: p.number('rows', 3),
        amplitude: p.number('amplitude', 5),
        wavelength: p.number('wavelength', 36),
      }),
  },
  {
    id: 'grass',
    label: 'Grass',
    category: 'nature',
    fields: [
      num('length', 'Length', [10, 2000, 1]),
      num('height', 'Blade height', [2, 120, 1]),
      num('density', 'Density', [0.1, 6, 0.1]),
      ...INK_FIELDS,
    ],
    defaults: { length: 240, height: 22, density: 1.5 },
    build: (s, p) =>
      s.grass([-p.number('length', 240) / 2, 0], [p.number('length', 240) / 2, 0], {
        ...ink(p),
        height: p.number('height', 22),
        density: p.number('density', 1.5),
      }),
  },
  {
    id: 'scribble',
    label: 'Scribble',
    category: 'shapes',
    fields: [RADIUS, num('turns', 'Turns', [1, 20, 1]), ...INK_FIELDS],
    defaults: { r: 30, turns: 6 },
    build: (s, p) =>
      s.scribble(ORIGIN, p.number('r', 30), { ...ink(p), turns: p.number('turns', 6) }),
  },
  {
    id: 'pebbles',
    label: 'Pebble field',
    category: 'textures',
    fields: [
      ...SIZE,
      num('minR', 'Smallest', [2, 60, 1]),
      num('maxR', 'Largest', [3, 120, 1]),
      pick('shade', 'Shade', SHADES),
    ],
    defaults: { w: 300, h: 160, minR: 5, maxR: 16, shade: 'stipple' },
    build: (s, p) =>
      s.pebbles(
        {
          x: -p.number('w', 300) / 2,
          y: -p.number('h', 160) / 2,
          w: p.number('w', 300),
          h: p.number('h', 160),
        },
        {
          minR: p.number('minR', 5),
          maxR: p.number('maxR', 16),
          shade: p.choice('shade', SHADES, 'stipple'),
        },
      ),
  },
  {
    id: 'cracks',
    label: 'Cracked earth',
    category: 'textures',
    fields: [...SIZE, num('cells', 'Plates', [4, 600, 1]), ...INK_FIELDS],
    defaults: { w: 300, h: 160, cells: 40 },
    build: (s, p) =>
      s.cracks(
        {
          x: -p.number('w', 300) / 2,
          y: -p.number('h', 160) / 2,
          w: p.number('w', 300),
          h: p.number('h', 160),
        },
        { ...ink(p), cells: p.number('cells', 40) },
      ),
  },
  {
    id: 'logEnd',
    label: 'Log end',
    category: 'textures',
    fields: [RADIUS, num('rings', 'Rings', [2, 40, 1]), ...INK_FIELDS],
    defaults: { r: 40, rings: 7 },
    build: (s, p) =>
      s.logEnd(ORIGIN, p.number('r', 40), { ...ink(p), rings: p.number('rings', 7) }),
  },
  {
    id: 'swarm',
    label: 'Crowd',
    category: 'crowds',
    fields: [
      pick('shape', 'Shape', SWARM_SHAPES),
      RADIUS,
      num('count', 'Count', [1, 20000, 1]),
      pick('kind', 'Kind', SWARM_KINDS),
      num('size', 'Size', [0.5, 60, 0.5]),
      pick('motion', 'Motion', SWARM_MOTIONS),
      pick('perspective', 'Perspective', YES_NO),
      { key: 'color', label: 'Color', type: 'color' },
    ],
    defaults: {
      shape: 'ring',
      r: 140,
      count: 600,
      kind: 'figure',
      size: 10,
      motion: 'orbit',
      perspective: 'no',
    },
    build: (s, p) => {
      const shape = swarmShape(p.choice('shape', SWARM_SHAPES, 'ring'), p.number('r', 140));

      s.swarm({
        shape,
        count: p.number('count', 600),
        kind: p.choice('kind', SWARM_KINDS, 'figure'),
        size: p.number('size', 10),
        motion: p.choice('motion', SWARM_MOTIONS, 'orbit'),
        perspective: p.choice('perspective', YES_NO, 'no') === 'yes',
        color: p.color('color'),
      });
    },
  },
];

export const COMPONENTS_BY_ID = new Map(COMPONENTS.map((c) => [c.id, c]));

export const POSE_OPTIONS = Object.keys(poses);
