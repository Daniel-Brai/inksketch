import { clamp } from './geometry.ts';
import type { FlipbookFrame, Motion, MotionFrame } from './model.ts';
import type { LoopTiming } from './render.types.ts';
import { readNumbers } from './scan.ts';

export type FrameValues = Required<Omit<MotionFrame, 'easing' | 'offset'>>;

export const IDENTITY_VALUES: FrameValues = {
  x: 0,
  y: 0,
  rotate: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
};

const VALUE_KEYS: ReadonlyArray<keyof FrameValues> = [
  'x',
  'y',
  'rotate',
  'scale',
  'scaleX',
  'scaleY',
  'opacity',
];

type Curve = readonly [number, number, number, number];

const EASE_CURVE: Curve = [0.25, 0.1, 0.25, 1];

const NAMED_CURVES: Record<string, Curve> = {
  linear: [0, 0, 1, 1],
  ease: EASE_CURVE,
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

function bezierAxis(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function solveBezier(curve: readonly [number, number, number, number], x: number): number {
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;

    if (bezierAxis(curve[0], curve[2], mid) < x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return bezierAxis(curve[1], curve[3], (lo + hi) / 2);
}

function curveOf(easing: string): Curve | 'step-end' | 'step-start' {
  const named = NAMED_CURVES[easing];

  if (named) return named;

  if (easing === 'step-end' || easing === 'step-start') return easing;

  const v = readNumbers(easing);
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = v;

  if (easing.startsWith('cubic-bezier') && v.length === 4) return [x1, y1, x2, y2];

  return EASE_CURVE;
}

export function ease(easing: string, x: number): number {
  const curve = curveOf(easing);

  if (curve === 'step-end') return x >= 1 ? 1 : 0;

  if (curve === 'step-start') return x > 0 ? 1 : 0;

  return solveBezier(curve, x);
}

export function mergeValues(prev: FrameValues, frame: MotionFrame): FrameValues {
  const next = { ...prev };

  for (const k of VALUE_KEYS) {
    const v = frame[k];
    if (v !== undefined) next[k] = v;
  }

  return next;
}

function resolvedFrames(
  frames: MotionFrame[],
): Array<{ offset: number; easing: string | undefined; values: FrameValues }> {
  let values = IDENTITY_VALUES;

  return frames.map((frame) => {
    values = mergeValues(values, frame);
    return { offset: frame.offset, easing: frame.easing, values };
  });
}

function iterationAt(m: Motion, local: number): { iteration: number; raw: number } {
  if (m.iterations === 'infinite' || local < m.iterations * m.duration) {
    return { iteration: Math.floor(local / m.duration), raw: (local % m.duration) / m.duration };
  }

  return { iteration: Math.max(0, Math.ceil(m.iterations) - 1), raw: 1 };
}

function phaseAt(m: Motion, local: number): number {
  const { iteration, raw } = iterationAt(m, local);
  const odd = iteration % 2 === 1;

  switch (m.direction) {
    case 'reverse':
      return 1 - raw;
    case 'alternate':
      return odd ? 1 - raw : raw;
    case 'alternate-reverse':
      return odd ? raw : 1 - raw;
    case 'normal':
      return raw;
  }
}

export function motionAt(m: Motion, delay: number, time: number): FrameValues {
  const frames = resolvedFrames(m.frames);
  const local = Math.max(0, time - delay);
  const phase = phaseAt(m, local);
  const first = frames[0];
  const last = frames.at(-1);

  if (!first || !last) return IDENTITY_VALUES;

  if (phase <= first.offset) return first.values;

  if (phase >= last.offset) return last.values;

  const k = frames.findIndex(
    (fr, i) => fr.offset <= phase && (frames[i + 1]?.offset ?? 1) >= phase,
  );

  const a = frames[k] ?? first;
  const b = frames[k + 1] ?? last;
  const span = b.offset - a.offset || 1;
  const u = ease(a.easing ?? m.easing, (phase - a.offset) / span);
  const mix = (x: number, y: number): number => x + (y - x) * u;
  const out = { ...a.values };

  for (const key of VALUE_KEYS) out[key] = mix(a.values[key], b.values[key]);

  return out;
}

export function flipbookIndexAt(frame: FlipbookFrame, time: number): number {
  const local = Math.max(0, time - frame.delay);
  const step = Math.floor((local / 1000) * frame.fps);

  if (frame.once) return Math.min(frame.count - 1, step);

  return step % frame.count;
}

export function drawProgressAt(
  slot: [number, number],
  time: number,
  loop: LoopTiming | null,
): { drawn: number; opacity: number } {
  const local = loop ? time % loop.cycle : time;
  const drawn = clamp((local - slot[0]) / (slot[1] || 1));

  if (!loop || local <= loop.hold) return { drawn, opacity: 1 };

  return { drawn, opacity: clamp(1 - (local - loop.hold) / (loop.cycle - loop.hold)) };
}
