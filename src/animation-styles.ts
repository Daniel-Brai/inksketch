import { clamp, f } from './geometry.ts';
import type { KeyframeRegistry } from './keyframes.ts';
import type { FlipbookFrame, Motion, MotionFrame, MotionOrigin } from './model.ts';
import type { RenderContext } from './render.types.ts';
import {
  drawProgressAt,
  flipbookIndexAt,
  IDENTITY_VALUES,
  mergeValues,
  motionAt,
  type FrameValues,
} from './sampling.ts';

const pct = (v: number): string => `${Math.round(clamp(v) * 10000) / 100}%`;

function drawBody(kind: 'draw' | 'fade', loop: { s: number; e: number; h: number } | null): string {
  if (!loop && kind === 'draw') return 'from{stroke-dashoffset:1.002}to{stroke-dashoffset:0}';

  if (!loop) return 'from{opacity:0}to{opacity:1}';

  const { s, e, h } = loop;

  if (kind === 'draw') {
    return [
      '0%{stroke-dashoffset:1.002;opacity:1}',
      `${pct(s)}{stroke-dashoffset:1.002}`,
      `${pct(e)}{stroke-dashoffset:0}`,
      `${pct(h)}{opacity:1}`,
      '100%{stroke-dashoffset:0;opacity:0}',
    ].join('');
  }

  return [
    '0%{opacity:0}',
    `${pct(s)}{opacity:0}`,
    `${pct(e)}{opacity:1}`,
    `${pct(h)}{opacity:1}`,
    '100%{opacity:0}',
  ].join('');
}

export interface DrawStyle {
  className: string | null;
  style: string;
}

const DRAW_CLASS = 'ik-d';
export const FADE_CLASS = 'ik-f';

export function sharedDrawCss(
  ctx: Pick<RenderContext, 'keyframes' | 'easing'>,
  scope: string,
): string {
  const draw = ctx.keyframes.nameFor(drawBody('draw', null));
  const fade = ctx.keyframes.nameFor(drawBody('fade', null));

  return [
    `.${scope} .${DRAW_CLASS}{stroke-dasharray:1 2;animation:${draw} var(--t) ${ctx.easing} var(--d) both}`,
    `.${scope} .${FADE_CLASS}{animation:${fade} var(--t) ${ctx.easing} var(--d) both}`,
  ].join('');
}

function loopStyle(ctx: RenderContext, kind: 'draw' | 'fade', slot: [number, number]): DrawStyle {
  const loop = ctx.loop;

  if (!loop) throw new Error('inksketch: loop style requested without loop timing');

  const [start, duration] = slot;

  const timing = {
    s: start / loop.cycle,
    e: (start + duration) / loop.cycle,
    h: loop.hold / loop.cycle,
  };

  const animation = `animation:${ctx.keyframes.nameFor(drawBody(kind, timing))} ${Math.round(loop.cycle)}ms linear 0ms infinite both`;

  if (kind === 'fade') return { className: null, style: animation };

  return { className: null, style: `stroke-dasharray:1 2;${animation}` };
}

function frozenStyle(ctx: RenderContext, kind: 'draw' | 'fade', slot: [number, number]): DrawStyle {
  const { drawn, opacity } = drawProgressAt(slot, ctx.time ?? 0, ctx.loop);

  if (drawn <= 0) return { className: null, style: 'visibility:hidden' };

  if (kind === 'fade') return { className: null, style: `opacity:${f(drawn * opacity, 3)}` };

  return {
    className: null,
    style: `stroke-dasharray:1 2;stroke-dashoffset:${f(1.002 * (1 - drawn), 4)};opacity:${f(opacity, 3)}`,
  };
}

export function drawStyle(ctx: RenderContext, id: number, kind: 'draw' | 'fade'): DrawStyle | null {
  if (!ctx.animate) return null;

  const slot = ctx.timeline.times.get(id);

  if (!slot) return null;

  if (ctx.time !== null) return frozenStyle(ctx, kind, slot);

  if (ctx.loop) return loopStyle(ctx, kind, slot);

  const className = kind === 'draw' ? DRAW_CLASS : FADE_CLASS;

  return { className, style: `--t:${Math.round(slot[1])}ms;--d:${Math.round(slot[0])}ms` };
}

function motionBody(frames: MotionFrame[]): string {
  const withOpacity = frames.some((fr) => fr.opacity !== undefined);
  let values = IDENTITY_VALUES;
  let body = '';

  for (const fr of frames) {
    values = mergeValues(values, fr);

    const declarations = [`transform:${transformOf(values)}`];

    if (withOpacity) declarations.push(`opacity:${f(values.opacity)}`);

    if (fr.easing) declarations.push(`animation-timing-function:${fr.easing}`);

    body += `${pct(fr.offset)}{${declarations.join(';')}}`;
  }

  return body;
}

function transformOrigin(origin: MotionOrigin): string {
  switch (origin) {
    case 'center':
      return 'transform-box:fill-box;transform-origin:50% 50%';
    case 'bottom':
      return 'transform-box:fill-box;transform-origin:50% 100%';
    case 'top':
      return 'transform-box:fill-box;transform-origin:50% 0%';
    default:
      return `transform-box:view-box;transform-origin:${f(origin[0])}px ${f(origin[1])}px`;
  }
}

function motionDelay(ctx: RenderContext, m: Motion, groupId: number): number {
  if (m.delay !== 'drawn') return m.delay;

  if (!ctx.animate && ctx.time === null) return 0;

  return ctx.timeline.ends.get(groupId) ?? 0;
}

function transformOf(values: FrameValues): string {
  const sx = values.scale * values.scaleX;
  const sy = values.scale * values.scaleY;

  return `translate(${f(values.x)}px,${f(values.y)}px) rotate(${f(values.rotate)}deg) scale(${f(sx)},${f(sy)})`;
}

export function motionStyle(ctx: RenderContext, m: Motion, groupId: number): string {
  if (ctx.time !== null) {
    const values = motionAt(m, motionDelay(ctx, m, groupId), ctx.time);
    return `${transformOrigin(m.origin)};transform:${transformOf(values)};opacity:${f(values.opacity, 3)}`;
  }

  const name = ctx.keyframes.nameFor(motionBody(m.frames));
  const delay = Math.round(motionDelay(ctx, m, groupId));
  const iterations = String(m.iterations);

  return `${transformOrigin(m.origin)};animation:${name} ${Math.round(m.duration)}ms ${m.easing} ${delay}ms ${iterations} ${m.direction} both`;
}

function flipbookEnter(index: number, count: number): string {
  if (index === 0) return '0%{visibility:visible}';

  return `0%{visibility:hidden}${pct(index / count)}{visibility:visible}`;
}

function flipbookExit(index: number, count: number): string {
  if (index === count - 1) return '100%{visibility:visible}';

  return `${pct((index + 1) / count)}{visibility:hidden}100%{visibility:hidden}`;
}

function flipbookBody(index: number, count: number): string {
  return flipbookEnter(index, count) + flipbookExit(index, count);
}

export function isActiveFrame(frame: FlipbookFrame, time: number): boolean {
  return flipbookIndexAt(frame, time) === frame.index;
}

export function windowStyle(
  keyframes: KeyframeRegistry,
  window: { fromMs: number; toMs: number | null },
): string {
  const show = keyframes.nameFor('0%,100%{opacity:1}');
  const hide = keyframes.nameFor('0%,100%{opacity:0}');
  const appear = `${show} 1ms step-end ${Math.round(window.fromMs)}ms forwards`;

  if (window.toMs === null) return `opacity:0;animation:${appear}`;

  return `opacity:0;animation:${appear},${hide} 1ms step-end ${Math.round(window.toMs)}ms forwards`;
}

export function flipbookStyle(keyframes: KeyframeRegistry, frame: FlipbookFrame): string | null {
  if (frame.count < 2) return null;

  const name = keyframes.nameFor(flipbookBody(frame.index, frame.count));
  const duration = Math.round((frame.count / frame.fps) * 1000);
  const animation = `animation:${name} ${duration}ms step-end ${Math.round(frame.delay)}ms ${frame.once ? '1' : 'infinite'} both`;

  if (frame.index === 0) return animation;

  return `visibility:hidden;${animation}`;
}
