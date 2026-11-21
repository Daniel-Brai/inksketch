import { sketch } from '#/create.ts';
import { MAX_FLIPBOOK_FRAMES } from '#/limits.ts';
import type { Motion, MotionFrame } from '#/model.ts';
import { motion, motions } from '#/motion.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import { COMPONENTS_BY_ID, type ComponentDef } from './components.ts';
import type {
  ElementDoc,
  ProjectDoc,
  PropValue,
  SceneDoc,
  TransformTracks,
} from './document.types.ts';
import { Props } from './props.ts';
import { sampleTrack, sorted, trackSpan } from './tracks.ts';

const PROJECT_BYTE_BUDGET = 6_000_000;
const ELEMENT_BYTE_FLOOR = 120_000;

interface BuildContext {
  offsetMs: number;
  fps: number;
  byteBudget: number;
}

const TRANSFORM_KEYS: ReadonlyArray<keyof TransformTracks> = [
  'x',
  'y',
  'rotate',
  'scale',
  'opacity',
];

function propsAt(def: ComponentDef, el: ElementDoc, time: number | null): Props {
  const values: Record<string, PropValue> = { ...def.defaults, ...el.props };

  if (time === null) return new Props(values);

  for (const [key, track] of Object.entries(el.propTracks)) {
    if (track.length) values[key] = sampleTrack(sorted(track), time);
  }

  return new Props(values);
}

function frameBytes(s: Sketch, def: ComponentDef, props: Props): number {
  const probe = sketch({ width: s.width, height: s.height, style: s.preset, seed: s.seed });
  const empty = probe.toSVG({ static: true, id: 'p' }).length;

  def.build(probe, props);

  return Math.max(1, probe.toSVG({ static: true, id: 'p' }).length - empty);
}

function drawComponent(
  s: Sketch,
  def: ComponentDef,
  o: { el: ElementDoc; ctx: BuildContext },
): void {
  const span = trackSpan(Object.values(o.el.propTracks));

  if (!span) {
    def.build(s, propsAt(def, o.el, null));
    return;
  }

  const length = span.endMs - span.startMs;
  const wanted = Math.min(MAX_FLIPBOOK_FRAMES, Math.ceil((length * o.ctx.fps) / 1000) + 1);

  const heaviest = Math.max(
    frameBytes(s, def, propsAt(def, o.el, span.startMs)),
    frameBytes(s, def, propsAt(def, o.el, span.endMs)),
  );

  const affordable = Math.max(2, Math.floor(o.ctx.byteBudget / heaviest));
  const count = Math.min(wanted, affordable);
  const step = length / (count - 1);
  const fps = (count - 1) / (length / 1000);

  s.frames(count, (sk, i) => def.build(sk, propsAt(def, o.el, span.startMs + i * step)), {
    fps,
    delayMs: o.ctx.offsetMs + span.startMs,
    once: true,
  });
}

function transformFrames(el: ElementDoc, times: number[]): MotionFrame[] {
  const t0 = times[0] ?? 0;
  const span = (times.at(-1) ?? t0) - t0 || 1;

  return times.map((t) => {
    const frame: MotionFrame = { offset: (t - t0) / span };

    const at = (key: keyof TransformTracks): number | null => {
      const track = el.tracks[key];
      if (!track?.length) return null;

      const v = sampleTrack(sorted(track), t);

      return typeof v === 'number' ? v : null;
    };

    const x = at('x');
    const y = at('y');
    const rotate = at('rotate');
    const scale = at('scale');
    const opacity = at('opacity');

    if (x !== null) frame.x = x - el.x;

    if (y !== null) frame.y = y - el.y;

    if (rotate !== null) frame.rotate = rotate - el.rotate;

    if (scale !== null) frame.scale = scale / (el.scale || 1);

    if (opacity !== null) frame.opacity = opacity;

    return frame;
  });
}

const MAX_TRANSFORM_SAMPLES = 600;

function sampleTimes(keyTimes: number[], fps: number): number[] {
  const first = keyTimes[0] ?? 0;
  const last = keyTimes.at(-1) ?? first;
  const step = Math.max(1000 / fps, (last - first) / MAX_TRANSFORM_SAMPLES);
  const times = new Set(keyTimes);

  for (let t = first + step; t < last; t += step) times.add(Math.round(t));

  return [...times].toSorted((a, b) => a - b);
}

function transformMotion(el: ElementDoc, ctx: BuildContext): Motion | null {
  const keyTimes = [
    ...new Set(TRANSFORM_KEYS.flatMap((k) => (el.tracks[k] ?? []).map((key) => key.atMs))),
  ].toSorted((a, b) => a - b);

  if (keyTimes.length < 2) return null;

  const times = sampleTimes(keyTimes, Math.max(ctx.fps, 24));
  const t0 = times[0] ?? 0;
  const t1 = times.at(-1) ?? t0;

  return motion(transformFrames(el, times), {
    duration: t1 - t0,
    delay: ctx.offsetMs + t0,
    iterations: 1,
    easing: 'linear',
  });
}

function presetOptions(options: Record<string, number>, offsetMs: number): Record<string, number> {
  const out: Record<string, number> = { ...options, delay: offsetMs + (options.delay ?? 0) };

  for (const [key, value] of Object.entries(out)) if (!Number.isFinite(value)) delete out[key];

  return out;
}

function presetMotion(
  preset: { preset: string; options: Record<string, number> },
  offsetMs: number,
): Motion | null {
  const o = presetOptions(preset.options, offsetMs);

  switch (preset.preset) {
    case 'bounce':
      return motions.bounce(o);
    case 'float':
      return motions.float(o);
    case 'pulse':
      return motions.pulse(o);
    case 'spin':
      return motions.spin(o);
    case 'wiggle':
      return motions.wiggle(o);
    case 'sway':
      return motions.sway(o);
    case 'blink':
      return motions.blink(o);
    case 'fadeIn':
      return motions.fadeIn(o);
    case 'pop':
      return motions.pop(o);
    default:
      return null;
  }
}

function decorate(shape: Shape, el: ElementDoc, ctx: BuildContext): void {
  const moving = transformMotion(el, ctx);
  const preset = el.motion ? presetMotion(el.motion, ctx.offsetMs) : null;

  if (moving) shape.animate(moving);

  if (preset) shape.animate(preset);

  if (el.draw) {
    shape.at(ctx.offsetMs + el.draw.startMs).duration(el.draw.durationMs);
  } else {
    shape.instant();
  }

  if (el.opacity !== 1) shape.opacity(el.opacity);

  if (el.visible.fromMs > 0 || el.visible.toMs !== null) {
    const toMs = el.visible.toMs === null ? null : ctx.offsetMs + el.visible.toMs;
    shape.between(ctx.offsetMs + el.visible.fromMs, toMs);
  }
}

function buildElement(s: Sketch, el: ElementDoc, ctx: BuildContext): void {
  if (el.hidden) return;

  const def = COMPONENTS_BY_ID.get(el.component);

  const content = (): void => {
    if (def) drawComponent(s, def, { el, ctx });

    for (const child of el.children) buildElement(s, child, ctx);
  };

  const shape = s.group(() => {
    s.group(
      () => {
        if (el.style) {
          s.withStyle(el.style, content);
        } else {
          content();
        }
      },
      { x: el.x, y: el.y, rotate: el.rotate, scale: el.scale },
    );
  });

  decorate(shape, el, ctx);
}

function drawingFor(project: ProjectDoc, scene: SceneDoc): Sketch {
  return sketch({
    width: project.width,
    height: project.height,
    style: scene.style,
    palette: project.palette,
    seed: scene.seed,
    background: scene.background,
    texture: scene.texture,
    vignette: scene.vignette,
    draw: { delayMs: 0, maxDurationMs: Number.MAX_SAFE_INTEGER },
  });
}

function animatedCount(elements: ElementDoc[]): number {
  return elements.reduce(
    (sum, el) => sum + (Object.keys(el.propTracks).length ? 1 : 0) + animatedCount(el.children),
    0,
  );
}

function budgetFor(scenes: SceneDoc[]): number {
  const animated = scenes.reduce((sum, scene) => sum + animatedCount(scene.elements), 0);
  return Math.max(ELEMENT_BYTE_FLOOR, PROJECT_BYTE_BUDGET / Math.max(1, animated));
}

export function buildScene(project: ProjectDoc, sceneIndex: number): Sketch {
  const scene = project.scenes[sceneIndex];

  if (!scene) throw new Error(`inksketch: scene ${sceneIndex} does not exist`);

  const s = drawingFor(project, scene);

  const byteBudget = budgetFor([scene]);

  for (const el of scene.elements) buildElement(s, el, { offsetMs: 0, fps: scene.fps, byteBudget });

  return s;
}

export function sceneStarts(project: ProjectDoc): number[] {
  let at = 0;

  return project.scenes.map((scene) => {
    const start = at;

    at += scene.durationMs;

    return start;
  });
}

export function projectDuration(project: ProjectDoc): number {
  return project.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
}

export function sceneAt(project: ProjectDoc, timeMs: number): { index: number; localMs: number } {
  const starts = sceneStarts(project);

  const index = Math.max(
    0,
    starts.findLastIndex((start) => start <= timeMs),
  );

  return { index, localMs: timeMs - (starts[index] ?? 0) };
}

export function buildProject(project: ProjectDoc): Sketch {
  const first = project.scenes[0];

  if (!first) throw new Error('inksketch: a project needs at least one scene');

  const s = drawingFor(project, { ...first, background: 'none' });
  const starts = sceneStarts(project);
  const byteBudget = budgetFor(project.scenes);

  project.scenes.forEach((scene, i) => {
    const start = starts[i] ?? 0;
    const previous = project.scenes[i - 1];
    const fadeIn = previous?.transition.kind === 'fade' ? previous.transition.durationMs : 0;
    const fadeOut = scene.transition.kind === 'fade' ? scene.transition.durationMs : 0;
    const end = i === project.scenes.length - 1 ? null : start + scene.durationMs + fadeOut;

    const group = s
      .group(() => {
        if (scene.background !== 'none') {
          s.raw(
            `<rect width="${project.width}" height="${project.height}" stroke="none" fill="${s.color(scene.background)}"/>`,
          );
        }

        s.withStyle(scene.style, () => {
          for (const el of scene.elements) {
            buildElement(s, el, { offsetMs: start, fps: scene.fps, byteBudget });
          }
        });
      })
      .instant();

    group.between(start, end);

    if (fadeIn > 0) group.animate(motions.fadeIn({ delay: start, duration: fadeIn }));
  });

  return s;
}
