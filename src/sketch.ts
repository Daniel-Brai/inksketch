import { ColorRegistry } from './colors.ts';
import * as diagrams from './figures/diagrams.ts';
import * as nature from './figures/nature.ts';
import * as objects from './figures/objects.ts';
import * as people from './figures/people.ts';
import * as textures from './figures/textures.ts';
import type * as F from './figures/types.ts';
import {
  directionalTone,
  hatchLines,
  hatchSegmentsBounded,
  normalizeFill,
  shadeFill,
  stipplePoints,
  toneRuns,
  type HatchFill,
  type Shade,
  type ShadeSpec,
  type StippleFill,
  type WashFill,
} from './fills.ts';
import {
  add,
  bentLine,
  clamp,
  ellipsePoints,
  indexPath,
  lerp,
  mul,
  normal,
  normalize,
  numberAt,
  pointAt,
  polylineLength,
  resampleCount,
  rotate,
  sampleAt,
  spline,
  sub,
  taperedOutline,
  type Box,
  type Point,
  type Size,
} from './geometry.ts';
import { letteringStrokes, measureLettering } from './lettering.ts';
import { MAX_CONTOUR_STROKES, MAX_FLIPBOOK_FRAMES } from './limits.ts';
import {
  nodeBounds,
  type DotsNode,
  type FillNode,
  type GroupNode,
  type SceneNode,
  type StrokeNode,
  type TextNode,
} from './model.ts';
import type {
  ArcOptions,
  ArrowEnd,
  ArrowOptions,
  BlobOptions,
  BraceOptions,
  ContourHatchOptions,
  DotOptions,
  FrameOptions,
  GroupOptions,
  Ink,
  MorphOptions,
  PathOptions,
  SketchOptions,
  TaperOptions,
  TextOptions,
  ToneHatchOptions,
  ToneStippleOptions,
  TraceOptions,
} from './options.ts';
import { createRng, lineNoise, type Rng } from './random.ts';
import { renderSketch } from './render.ts';
import type { RenderOptions } from './render.types.ts';
import { Shape } from './shape.ts';
import { assertSize } from './sketch.helpers.ts';
import type { StrokeFeel } from './stroke.ts';
import {
  fontStack,
  resolvePalettes,
  resolvePreset,
  type Color,
  type Palettes,
  type Preset,
  type PresetName,
} from './style.ts';
import { readSVG } from './svg-import.ts';
import { parsePath } from './svgpath.ts';
import { swarm } from './swarm.ts';
import type { SwarmOptions } from './swarm.types.ts';
import type { ToneField } from './tone.ts';

export class Sketch {
  readonly width: number;
  readonly height: number;
  private currentPreset: Preset;
  readonly seed: number | string;
  readonly options: SketchOptions;
  readonly root: GroupNode;
  readonly palettes: Palettes;
  readonly colors = new ColorRegistry();
  readonly defs = new Map<string, { ref: string; node: GroupNode; bounds: Box }>();
  private readonly stack: GroupNode[];
  private readonly rng: Rng;
  private counter = 0;

  constructor(options: SketchOptions) {
    assertSize(options);

    this.options = options;
    this.width = options.width;
    this.height = options.height;
    this.currentPreset = resolvePreset(options.style);
    this.palettes = resolvePalettes(this.currentPreset, options.palette);
    this.seed = options.seed ?? 1;
    this.rng = createRng(this.seed);
    this.root = { kind: 'group', id: 0, children: [], motions: [], draw: {} };
    this.stack = [this.root];
  }

  get preset(): Preset {
    return this.currentPreset;
  }

  withStyle<T>(style: PresetName | Partial<Preset>, build: () => T): T {
    const previous = this.currentPreset;

    this.currentPreset = resolvePreset(style);

    try {
      return build();
    } finally {
      this.currentPreset = previous;
    }
  }

  color(value: Color | undefined): string {
    return this.colors.resolve(value);
  }

  random(salt: number | string = 'user'): Rng {
    return this.rng.fork(salt);
  }

  nextId(): number {
    this.counter += 1;
    return this.counter;
  }

  push<T extends SceneNode>(node: T): T {
    const parent = this.stack.at(-1) ?? this.root;

    parent.children.push(node);

    return node;
  }

  group(build: (s: this) => void, opts: GroupOptions = {}): Shape {
    const { label, className, ...transform } = opts;
    const hasTransform = Object.values(transform).some((v) => v !== undefined);

    const node: GroupNode = {
      kind: 'group',
      id: this.nextId(),
      children: [],
      motions: [],
      draw: {},
      label,
      className,
      transform: hasTransform ? transform : undefined,
    };

    this.push(node);
    this.stack.push(node);

    try {
      build(this);
    } finally {
      this.stack.pop();
    }

    return new Shape(node);
  }

  reuse(key: string, build: (s: this) => void): Shape {
    this.define(key, build);
    return this.use(key);
  }

  define(key: string, build: (s: this) => void): void {
    if (this.defs.has(key)) return;

    const node = this.detached(build);

    this.defs.set(key, { ref: `d${this.defs.size}`, node, bounds: nodeBounds(node) });
  }

  use(key: string): Shape {
    const def = this.defs.get(key);

    if (!def) throw new Error(`inksketch: nothing is defined as "${key}"`);

    return this.group(() => {
      this.push({ kind: 'use', id: this.nextId(), ref: def.ref, bounds: def.bounds });
    });
  }

  private detached(build: (s: this) => void): GroupNode {
    const node: GroupNode = {
      kind: 'group',
      id: this.nextId(),
      children: [],
      motions: [],
      draw: { instant: true },
    };

    this.stack.push(node);

    try {
      build(this);
    } finally {
      this.stack.pop();
    }

    return node;
  }

  frames(
    count: number,
    build: (s: this, index: number, t: number) => void,
    opts: FrameOptions = {},
  ): Shape {
    const fps = Math.max(1, opts.fps ?? 8);
    const delay = opts.delayMs ?? 0;
    const total = Math.max(1, Math.min(MAX_FLIPBOOK_FRAMES, Math.round(count)));

    return this.group(() => {
      for (let index = 0; index < total; index++) {
        const frame = this.group(() => build(this, index, index / total));
        frame.node.frame = { index, count: total, fps, delay, once: opts.once ?? false };
      }
    }).instant();
  }

  feel(
    o: {
      roughness?: number | undefined;
      bowing?: number | undefined;
      overshoot?: number | undefined;
    } = {},
  ): StrokeFeel {
    return {
      roughness: o.roughness ?? this.preset.roughness,
      bowing: o.bowing ?? this.preset.bowing,
      overshoot: o.overshoot ?? this.preset.overshoot,
    };
  }

  stroke(points: Point[], closed: boolean, o: Ink = {}, smooth = true): StrokeNode {
    const width = o.width ?? this.preset.strokeWidth;

    return this.push<StrokeNode>({
      kind: 'stroke',
      id: this.nextId(),
      points,
      closed,
      smooth,
      feel: this.feel(o),
      width,
      color: this.colors.resolve(o.color),
      opacity: o.opacity,
      dash: this.dashArray(o, width),
      cap: o.cap ?? 'round',
      passes: this.preset.passes,
      passOpacity: this.preset.passOpacity,
      pressure: o.pressure ?? 0,
      draw: o.draw ?? true,
    });
  }

  hatch(poly: Point[], spec: Omit<HatchFill, 'type'> = {}, o: Ink = {}): Shape {
    const rng = this.rng.fork(`hatch:${this.counter}`);
    const gap = spec.gap ?? this.preset.hatchGap;
    const angle = spec.angle ?? this.preset.hatchAngle;
    const angles = spec.cross ? [angle, angle + (spec.cross === true ? 90 : spec.cross)] : [angle];

    const ink: Ink = {
      color: spec.color ?? o.color,
      width: spec.width ?? (o.width ?? this.preset.strokeWidth) * 0.55,
      opacity: spec.opacity ?? o.opacity,
      roughness: (o.roughness ?? this.preset.roughness) * 0.5,
      bowing: 0,
      overshoot: 0,
      draw: o.draw,
    };

    return this.group(() => {
      for (const a of angles) {
        for (const [p, q] of hatchLines(poly, a, gap, rng)) this.stroke([p, q], false, ink, false);
      }
    }).gap(12);
  }

  stipple(poly: Point[], spec: Omit<StippleFill, 'type'> = {}, o: Ink = {}): Shape {
    const rng = this.rng.fork(`stipple:${this.counter}`);

    const tone =
      spec.from === undefined ? null : directionalTone(poly, spec.from, spec.strength ?? 0.6);

    const points = stipplePoints(poly, { density: spec.density ?? 2.5, tone }, rng);

    return this.dots(points, {
      size: spec.size ?? this.dotSize(o),
      color: spec.color ?? o.color,
      opacity: spec.opacity ?? o.opacity,
      draw: o.draw,
    });
  }

  toneStipple(poly: Point[], tone: ToneField, o: ToneStippleOptions = {}): Shape {
    const { density = 8, size, ...ink } = o;

    const points = stipplePoints(
      poly,
      { density, tone },
      this.rng.fork(`tone-stipple:${this.counter}`),
    );

    return this.dots(points, {
      size: size ?? this.dotSize(ink),
      color: ink.color,
      opacity: ink.opacity,
      draw: ink.draw,
    });
  }

  toneHatch(poly: Point[], tone: ToneField, o: ToneHatchOptions = {}): Shape {
    const { layers = 3, gap = 4, angleDeg = this.preset.hatchAngle, ...ink } = o;
    const count = Math.max(1, Math.min(4, layers));
    const angles = [angleDeg, angleDeg + 90, angleDeg + 45, angleDeg - 45];

    const lineInk: Ink = {
      width: (ink.width ?? this.preset.strokeWidth) * 0.5,
      roughness: (ink.roughness ?? this.preset.roughness) * 0.4,
      bowing: 0,
      overshoot: 0,
      ...ink,
    };

    return this.group(() => {
      for (let layer = 0; layer < count; layer++) {
        const threshold = (layer + 0.5) / (count + 0.5);

        for (const segment of hatchSegmentsBounded(poly, numberAt(angles, layer), gap)) {
          for (const run of toneRuns(segment, tone, threshold)) {
            this.stroke([run[0], run[1]], false, lineInk, false);
          }
        }
      }
    }).gap(4);
  }

  shade(poly: Point[], kind: Shade, o: Ink & ShadeSpec = {}): Shape {
    const { angleDeg, gap, from, strength, density, ...ink } = o;
    const fill = shadeFill(kind, { angleDeg, gap, from, strength, density, color: ink.color });

    return this.polygon(poly, { ...ink, stroke: false, fill });
  }

  contourHatch(path: Point[], o: ContourHatchOptions = {}): Shape {
    const {
      length = 10,
      lengthEnd = length,
      gap = 5,
      side = 1,
      tiltDeg = 20,
      taper = true,
      ...ink
    } = o;

    const rng = this.rng.fork(`contour:${this.counter}`);
    const index = indexPath(path);
    const count = Math.min(MAX_CONTOUR_STROKES, Math.floor(index.total / Math.max(1, gap)));

    const strokeInk: Ink = {
      width: (ink.width ?? this.preset.strokeWidth) * 0.6,
      overshoot: 0,
      bowing: 0,
      ...ink,
    };

    return this.group(() => {
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count;
        const { p, dir } = sampleAt(index, u * index.total);
        const inward = rotate(mul([-dir[1], dir[0]], side), tiltDeg * side);
        const fade = taper ? Math.pow(Math.sin(Math.PI * u), 0.6) : 1;
        const len = (length + (lengthEnd - length) * u) * rng.range(0.65, 1) * fade;

        if (len > 1) this.stroke([p, add(p, mul(inward, len))], false, strokeInk, false);
      }
    }).gap(10);
  }

  line(from: Point, to: Point, o: Ink = {}): Shape {
    return this.group(() => {
      this.stroke([from, to], false, o);
    });
  }

  polyline(points: Point[], o: Ink = {}): Shape {
    return this.group(() => {
      const feel = this.feel(o);

      const separate =
        this.preset.overlapCorners && feel.roughness > 0 && !o.dashed && points.length > 2;

      if (!separate) {
        this.stroke(points, false, o, feel.roughness > 0);
        return;
      }

      for (let i = 1; i < points.length; i++) {
        this.stroke([pointAt(points, i - 1), pointAt(points, i)], false, o);
      }
    });
  }

  curve(points: Point[], o: Ink & { closed?: boolean } = {}): Shape {
    const closed = o.closed ?? false;

    return this.group(() => {
      const smooth = spline(points, closed);

      if (closed) {
        this.outline(smooth, o, true);
      } else {
        this.stroke(smooth, false, o);
      }
    });
  }

  polygon(points: Point[], o: Ink = {}): Shape {
    return this.group(() => this.outline(points, o, false));
  }

  path(d: string, o: PathOptions = {}): Shape {
    const { at = [0, 0], scale = 1, tolerance = 3, ...ink } = o;
    const place = (p: Point): Point => [at[0] + p[0] * scale, at[1] + p[1] * scale];

    return this.group(() => {
      for (const sub of parsePath(d, tolerance / scale)) {
        const pts = sub.points.map(place);

        if (sub.closed) {
          this.outline(pts, ink, true);
        } else {
          this.stroke(pts, false, ink);
        }
      }
    });
  }

  trace(svg: string, o: TraceOptions = {}): Shape {
    const { at = [0, 0], size, filled = 'solid', ...ink } = o;
    const { shapes, viewBox } = readSVG(svg);
    const target = size ?? [viewBox.w, viewBox.h];
    const k = Math.min(target[0] / (viewBox.w || 1), target[1] / (viewBox.h || 1));
    const ox = at[0] + (target[0] - viewBox.w * k) / 2;
    const oy = at[1] + (target[1] - viewBox.h * k) / 2;
    const place = (p: Point): Point => [ox + (p[0] - viewBox.x) * k, oy + (p[1] - viewBox.y) * k];

    return this.group(() => {
      for (const shape of shapes) {
        for (const sub of shape.subpaths) {
          const pts = sub.points.map(place);
          const fill = shape.filled && sub.closed ? filled : 'none';
          const stroke = shape.stroked || fill === 'none';

          if (sub.closed) {
            this.outline(pts, { ...ink, fill, stroke }, true);
          } else {
            this.stroke(pts, false, ink);
          }
        }
      }
    });
  }

  rect(at: Point, size: Size, o: Ink & { radius?: number } = {}): Shape {
    const [x, y] = at;
    const [w, h] = size;
    const r = Math.min(o.radius ?? 0, w / 2, h / 2);

    return this.group(() => {
      if (r <= 0) {
        this.outline(
          [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ],
          o,
          false,
        );

        return;
      }

      const corners: Point[] = [
        ...ellipsePoints([x + w - r, y + r], [r, r], [-90, 0], 15),
        ...ellipsePoints([x + w - r, y + h - r], [r, r], [0, 90], 15),
        ...ellipsePoints([x + r, y + h - r], [r, r], [90, 180], 15),
        ...ellipsePoints([x + r, y + r], [r, r], [180, 270], 15),
      ];

      this.outline(corners, o, true);
    });
  }

  circle(center: Point, r: number, o: Ink = {}): Shape {
    return this.ellipse(center, [r, r], o);
  }

  ellipse(center: Point, radii: Size, o: Ink = {}): Shape {
    return this.group(() => {
      const start = this.rng.fork(`ellipse:${this.counter}`).range(-160, -60);
      const pts = ellipsePoints(center, radii, [start, start + 360]);

      pts.pop();
      this.outline(pts, o, true);
    });
  }

  arc(center: Point, radii: Size, o: ArcOptions): Shape {
    const { fromDeg, toDeg, ...ink } = o;

    return this.group(() => {
      this.stroke(ellipsePoints(center, radii, [fromDeg, toDeg]), false, ink);
    });
  }

  blob(center: Point, radii: Size, o: BlobOptions = {}): Shape {
    const { irregularity = 0.18, flatBottom = 0, rotateDeg = 0, ...ink } = o;
    const [rx, ry] = radii;
    const n = lineNoise(this.rng.fork(`blob:${this.counter}`), 1.3);
    const steps = Math.max(24, Math.round((rx + ry) / 3));
    const pts: Point[] = [];

    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const k = 1 + n(i / (steps / 6)) * irregularity;
      const rawY = Math.sin(a) * ry * k;
      const y = rawY > 0 ? rawY * (1 - flatBottom) : rawY;

      pts.push(rotate([center[0] + Math.cos(a) * rx * k, center[1] + y], rotateDeg, center));
    }

    return this.group(() => this.outline(pts, ink, true));
  }

  arrow(from: Point, to: Point, o: ArrowOptions = {}): Shape {
    const [i0, i1] = Array.isArray(o.inset) ? o.inset : [o.inset ?? 0, o.inset ?? 0];
    const dir = normalize(sub(to, from));
    const path = bentLine(add(from, mul(dir, i0)), sub(to, mul(dir, i1)), o.bend ?? 0);
    const last = path.length - 1;

    return this.group(() => {
      this.stroke(path, false, o);
      this.arrowEnd([pointAt(path, last), pointAt(path, last - 1)], o.head ?? 'open', o);
      this.arrowEnd([pointAt(path, 0), pointAt(path, 1)], o.tail ?? 'none', o);
    });
  }

  brace(from: Point, to: Point, o: BraceOptions = {}): Shape {
    const depth = o.depth ?? Math.min(18, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.12);
    const n = normal(from, to);

    const ease = (e0: number, e1: number, x: number): number => {
      const k = clamp((x - e0) / (e1 - e0));
      return k * k * (3 - 2 * k);
    };

    const pts: Point[] = [];

    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const towardTip = t < 0.5 ? t * 2 : (1 - t) * 2;
      const off = 0.5 * ease(0, 0.18, towardTip) + 0.5 * ease(0.82, 1, towardTip);

      pts.push(add(lerp(from, to, t), mul(n, off * depth)));
    }

    return this.group(() => {
      this.stroke(pts, false, o);
    });
  }

  dots(points: Point[], o: DotOptions = {}): Shape {
    return this.group(() => {
      this.push<DotsNode>({
        kind: 'dots',
        id: this.nextId(),
        points,
        size: o.size ?? this.preset.strokeWidth * 2,
        color: this.colors.resolve(o.color),
        opacity: o.opacity,
        draw: o.draw ?? true,
      });
    });
  }

  dot(at: Point, o: DotOptions = {}): Shape {
    return this.dots([at], o);
  }

  text(at: Point, content: string, o: TextOptions = {}): Shape {
    const lettering = o.lettering ?? this.preset.lettering;
    const transform = { x: at[0], y: at[1], rotate: o.rotateDeg };

    return this.group(() => {
      if (lettering === 'hand') {
        this.handLettering(content, o);
      } else {
        this.fontText(content, o);
      }
    }, transform);
  }

  label(at: Point, content: string, o: TextOptions = {}): Shape {
    const size = o.size ?? 18;
    const lines = content.split('\n').length;
    const lh = (o.lineHeight ?? 1.6) * size;

    return this.text([at[0], at[1] + size / 2 - ((lines - 1) * lh) / 2], content, {
      anchor: 'middle',
      ...o,
    });
  }

  measure(content: string, size = 18): { width: number; height: number } {
    return measureLettering(content, { size });
  }

  raw(svg: string, bounds?: Box): Shape {
    return this.group(() => {
      this.push({ kind: 'raw', id: this.nextId(), svg, bounds });
    });
  }

  taper(path: Point[], widths: readonly [number, number], o: TaperOptions = {}): Shape {
    const { shade = 'none', hatchGap = 3, ...ink } = o;
    const { outline, left, right } = taperedOutline(path, widths);

    return this.group(() => {
      this.polygon(outline, {
        fill: 'paper',
        ...ink,
        roughness: (ink.roughness ?? this.preset.roughness) * 0.6,
      });

      if (shade === 'none') return;

      const edge = shade === 'right' ? right : left;
      const inward = shade === 'right' ? 1 : -1;

      this.contourHatch(edge, {
        ...ink,
        length: widths[0] * 0.45,
        lengthEnd: widths[1] * 0.45,
        gap: hatchGap,
        side: inward,
        tiltDeg: 10,
        taper: false,
      });
    });
  }

  morph(from: Point[], to: Point[], o: MorphOptions = {}): Shape {
    const { frames = 12, fps = 12, closed = false, pingpong = true, ...ink } = o;

    const count = Math.max(
      24,
      Math.min(200, Math.round(Math.max(polylineLength(from), polylineLength(to)) / 5)),
    );

    const a = resampleCount(from, count, closed);
    const b = resampleCount(to, count, closed);
    const steps = Array.from({ length: frames }, (_, i) => i / Math.max(1, frames - 1));
    const sequence = pingpong ? [...steps, ...steps.slice(1, -1).toReversed()] : steps;

    return this.frames(
      sequence.length,
      (s, index) => {
        const t = numberAt(sequence, index);
        const eased = t * t * (3 - 2 * t);
        const pts = a.map((p, i) => lerp(p, pointAt(b, i), eased));

        if (closed) {
          s.outline(pts, ink, true);
        } else {
          s.stroke(pts, false, ink);
        }
      },
      { fps },
    );
  }

  stickFigure(at: Point, o?: F.StickFigureOptions): Shape {
    return people.stickFigure(this, at, o);
  }

  person(at: Point, o?: F.PersonOptions): Shape {
    return people.person(this, at, o);
  }

  walker(at: Point, o?: F.WalkerOptions): Shape {
    return people.walker(this, at, o);
  }

  stone(center: Point, r: number, o?: F.StoneOptions): Shape {
    return objects.stone(this, center, r, o);
  }

  cylinder(center: Point, o?: F.CylinderOptions): Shape {
    return objects.cylinder(this, center, o);
  }

  cube(at: Point, size: number, o?: F.CubeOptions): Shape {
    return objects.cube(this, at, size, o);
  }

  document(at: Point, size: Size, o?: F.DocumentOptions): Shape {
    return objects.documentSheet(this, at, size, o);
  }

  cloud(center: Point, size: Size, o?: F.CloudOptions): Shape {
    return objects.cloud(this, center, size, o);
  }

  server(at: Point, size: Size, o?: F.ServerOptions): Shape {
    return objects.server(this, at, size, o);
  }

  lightbulb(center: Point, r: number, o?: F.LightbulbOptions): Shape {
    return objects.lightbulb(this, center, r, o);
  }

  gear(center: Point, r: number, o?: F.GearOptions): Shape {
    return objects.gear(this, center, r, o);
  }

  tree(base: Point, height: number, o?: F.TreeOptions): Shape {
    return nature.tree(this, base, height, o);
  }

  roots(base: Point, length: number, o?: F.TreeOptions): Shape {
    return nature.roots(this, base, length, o);
  }

  bonsai(base: Point, height: number, o?: F.BonsaiOptions): Shape {
    return nature.bonsai(this, base, height, o);
  }

  leaf(base: Point, length: number, o?: F.LeafOptions): Shape {
    return nature.leaf(this, base, length, o);
  }

  plant(base: Point, height: number, o?: F.PlantOptions): Shape {
    return nature.plant(this, base, height, o);
  }

  pot(top: Point, size: Size, o?: F.PotOptions): Shape {
    return nature.pot(this, top, size, o);
  }

  sun(center: Point, r: number, o?: F.SunOptions): Shape {
    return nature.sun(this, center, r, o);
  }

  waves(at: Point, width: number, o?: F.WavesOptions): Shape {
    return nature.waves(this, at, width, o);
  }

  scribble(center: Point, r: number, o?: F.ScribbleOptions): Shape {
    return nature.scribble(this, center, r, o);
  }

  pebbles(area: Box, o?: F.PebblesOptions): Shape {
    return textures.pebbles(this, area, o);
  }

  cracks(area: Box, o?: F.CracksOptions): Shape {
    return textures.cracks(this, area, o);
  }

  grass(from: Point, to: Point, o?: F.GrassOptions): Shape {
    return textures.grass(this, from, to, o);
  }

  logEnd(center: Point, r: number, o?: F.LogEndOptions): Shape {
    return textures.logEnd(this, center, r, o);
  }

  graph(nodes: F.GraphNode[], edges: F.GraphEdge[], o?: F.GraphOptions): Shape {
    return diagrams.graph(this, nodes, edges, o);
  }

  swarm(o: SwarmOptions): Shape {
    return swarm(this, o);
  }

  toSVG(opts: RenderOptions = {}): string {
    return renderSketch(this, opts);
  }

  outline(poly: Point[], o: Ink, round: boolean): void {
    const fill = normalizeFill(o.fill);
    const feel = this.feel(o);

    if (fill?.type === 'wash') this.wash(poly, fill, feel);

    if (fill?.type === 'solid') {
      this.push<FillNode>({
        kind: 'fill',
        id: this.nextId(),
        points: poly,
        color: this.colors.resolve(fill.color),
        opacity: fill.opacity,
        feel: { ...feel, overshoot: 0 },
        draw: o.draw ?? true,
      });
    }

    if (o.stroke !== false) this.outlineStroke(poly, o, round);

    if (fill?.type === 'hatch') this.hatch(poly, fill, o);

    if (fill?.type === 'stipple') this.stipple(poly, fill, o);
  }

  private wash(poly: Point[], fill: WashFill, feel: StrokeFeel): void {
    const rng = this.rng.fork(`wash:${this.counter}`);
    const shift = fill.offset ?? 3;
    const dx = rng.range(-shift, shift);
    const dy = rng.range(-shift, shift);

    this.push<FillNode>({
      kind: 'fill',
      id: this.nextId(),
      points: poly.map(([x, y]): Point => [x + dx, y + dy]),
      color: this.colors.resolve(fill.color ?? 'accent'),
      opacity: fill.opacity ?? 0.35,
      feel: { roughness: Math.max(1, feel.roughness) * 2.2, bowing: 1, overshoot: 0 },
      draw: true,
    });
  }

  private outlineStroke(poly: Point[], o: Ink, round: boolean): void {
    const feel = this.feel(o);
    const separateEdges = !round && this.preset.overlapCorners && feel.roughness > 0 && !o.dashed;

    if (!separateEdges) {
      this.stroke(poly, true, o, round || feel.roughness > 0);
      return;
    }

    for (let i = 0; i < poly.length; i++) {
      this.stroke([pointAt(poly, i), pointAt(poly, (i + 1) % poly.length)], false, o);
    }
  }

  private dotSize(o: Ink): number {
    return Math.max(1.4, (o.width ?? this.preset.strokeWidth) * 0.9);
  }

  private dashArray(o: Ink, width: number): number[] | undefined {
    if (!o.dashed) return undefined;

    if (Array.isArray(o.dashed)) return o.dashed;

    if (typeof o.dashed === 'number') return [o.dashed, o.dashed * 1.4];

    return [width * 2.2, width * 3.2];
  }

  private arrowEnd(tipAndPrev: [Point, Point], kind: ArrowEnd, o: ArrowOptions): void {
    if (kind === 'none') return;

    const [tip, prev] = tipAndPrev;
    const size = o.headSize ?? Math.max(9, (o.width ?? this.preset.strokeWidth) * 5);

    if (kind === 'dot') {
      this.dots([tip], { size: size * 0.6, color: o.color, draw: o.draw });
      return;
    }

    const back = normalize(sub(prev, tip));
    const left = add(tip, mul(rotate(back, 26), size));
    const right = add(tip, mul(rotate(back, -26), size));

    const head: Ink = {
      ...o,
      fill: 'none',
      dashed: false,
      overshoot: (o.overshoot ?? this.preset.overshoot) * 0.3,
    };

    if (kind === 'filled') {
      this.outline([left, tip, right], { ...head, fill: 'solid' }, false);
    } else {
      this.stroke([left, tip, right], false, head, false);
    }
  }

  private handLettering(content: string, o: TextOptions): void {
    const size = o.size ?? 18;
    const scale = Math.max(0.6, Math.min(2, size / 18));
    const roughness = (o.roughness ?? this.preset.roughness) * 0.22 * scale;
    const rng = this.rng.fork(`text:${this.counter}`);

    const jitter = () => ({
      dx: rng.gauss() * size * 0.012,
      dy: rng.gauss() * size * 0.025,
      rot: rng.gauss() * 0.035,
    });

    const strokes = letteringStrokes(content, [0, 0], {
      size,
      anchor: o.anchor ?? 'start',
      slant: o.slantDeg ?? (roughness > 0 ? 4 : 0),
      lineHeight: o.lineHeight,
      tracking: o.tracking,
      jitter: roughness > 0 ? jitter : undefined,
    });

    const widthScale = Math.min(1.6, Math.max(0.75, scale));

    const ink: Ink = {
      color: o.color,
      opacity: o.opacity,
      width: o.width ?? Math.max(1, this.preset.strokeWidth * 0.8 * widthScale),
      roughness,
      bowing: 0,
      overshoot: 0,
      draw: o.draw,
    };

    for (const st of strokes) this.stroke(st, false, ink, roughness > 0);
  }

  private fontText(content: string, o: TextOptions): void {
    const font = fontStack(o.font ?? this.preset.font);

    this.push<TextNode>({
      kind: 'text',
      id: this.nextId(),
      text: content,
      size: o.size ?? 18,
      anchor: o.anchor ?? 'start',
      font,
      weight: o.weight ?? 400,
      color: this.colors.resolve(o.color),
      opacity: o.opacity,
      draw: o.draw ?? true,
    });
  }
}
