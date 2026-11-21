import { dist, pointAt, polylineLength, type Point } from './geometry.ts';
import type { Motion, MotionFrame } from './model.ts';

export interface MotionOptions {
  duration?: number;
  delay?: number | 'drawn';
  iterations?: number | 'infinite';
  loop?: boolean;
  direction?: Motion['direction'];
  easing?: string;
  origin?: Motion['origin'];
}

function iterationsOf(opts: MotionOptions, fallback: Motion['iterations']): Motion['iterations'] {
  if (opts.loop === false) return 1;

  if (opts.iterations !== undefined) return opts.iterations;

  if (opts.loop) return 'infinite';

  return fallback;
}

export function motion(
  frames: MotionFrame[],
  opts: MotionOptions = {},
  defaults: Partial<Motion> = {},
): Motion {
  return {
    frames: frames.toSorted((a, b) => a.offset - b.offset),
    duration: opts.duration ?? defaults.duration ?? 1000,
    delay: opts.delay ?? defaults.delay ?? 0,
    iterations: iterationsOf(opts, defaults.iterations ?? 'infinite'),
    direction: opts.direction ?? defaults.direction ?? 'normal',
    easing: opts.easing ?? defaults.easing ?? 'ease-in-out',
    origin: opts.origin ?? defaults.origin ?? 'center',
  };
}

export const motions = {
  bounce(opts: MotionOptions & { height?: number; squash?: number } = {}): Motion {
    const h = opts.height ?? 40;
    const sq = opts.squash ?? 0.12;

    const frames: MotionFrame[] = [
      { offset: 0, y: 0, scaleX: 1 + sq, scaleY: 1 - sq, easing: 'ease-out' },
      { offset: 0.08, y: 0, scaleX: 1, scaleY: 1, easing: 'cubic-bezier(.15,.6,.35,1)' },
      {
        offset: 0.5,
        y: -h,
        scaleX: 1 - sq / 3,
        scaleY: 1 + sq / 3,
        easing: 'cubic-bezier(.65,0,.85,.4)',
      },
      { offset: 0.92, y: 0, scaleX: 1, scaleY: 1, easing: 'ease-in' },
      { offset: 1, y: 0, scaleX: 1 + sq, scaleY: 1 - sq },
    ];

    return motion(frames, opts, { duration: 1100, origin: 'bottom', easing: 'linear' });
  },

  float(opts: MotionOptions & { distance?: number } = {}): Motion {
    const frames = [
      { offset: 0, y: 0 },
      { offset: 1, y: -(opts.distance ?? 6) },
    ];
    return motion(frames, opts, { duration: 2600, direction: 'alternate' });
  },

  pulse(opts: MotionOptions & { scale?: number } = {}): Motion {
    const s = opts.scale ?? 1.06;

    const frames = [
      { offset: 0, scale: 1 },
      { offset: 0.5, scale: s },
      { offset: 1, scale: 1 },
    ];

    return motion(frames, opts, { duration: 1800 });
  },

  spin(opts: MotionOptions & { turns?: number } = {}): Motion {
    const frames = [
      { offset: 0, rotate: 0 },
      { offset: 1, rotate: 360 * (opts.turns ?? 1) },
    ];
    return motion(frames, opts, { duration: 6000, easing: 'linear' });
  },

  wiggle(opts: MotionOptions & { angle?: number } = {}): Motion {
    const a = opts.angle ?? 5;

    const frames = [
      { offset: 0, rotate: 0 },
      { offset: 0.25, rotate: a },
      { offset: 0.75, rotate: -a },
      { offset: 1, rotate: 0 },
    ];

    return motion(frames, opts, { duration: 700 });
  },

  sway(opts: MotionOptions & { angle?: number } = {}): Motion {
    const a = opts.angle ?? 3;

    const frames = [
      { offset: 0, rotate: -a },
      { offset: 1, rotate: a },
    ];

    return motion(frames, opts, { duration: 2800, direction: 'alternate', origin: 'bottom' });
  },

  fadeIn(opts: MotionOptions = {}): Motion {
    const frames = [
      { offset: 0, opacity: 0 },
      { offset: 1, opacity: 1 },
    ];
    return motion(frames, opts, { duration: 600, iterations: 1, easing: 'ease-out' });
  },

  pop(opts: MotionOptions = {}): Motion {
    const frames = [
      { offset: 0, scale: 0, opacity: 0 },
      { offset: 0.6, scale: 1.12, opacity: 1 },
      { offset: 1, scale: 1, opacity: 1 },
    ];
    return motion(frames, opts, { duration: 500, iterations: 1, easing: 'ease-out' });
  },

  slideIn(opts: MotionOptions & { dx?: number; dy?: number } = {}): Motion {
    const frames = [
      { offset: 0, x: opts.dx ?? -40, y: opts.dy ?? 0, opacity: 0 },
      { offset: 1, x: 0, y: 0, opacity: 1 },
    ];
    return motion(frames, opts, {
      duration: 700,
      iterations: 1,
      easing: 'cubic-bezier(.2,.7,.3,1)',
    });
  },

  blink(opts: MotionOptions & { min?: number } = {}): Motion {
    const frames = [
      { offset: 0, opacity: 1 },
      { offset: 0.5, opacity: opts.min ?? 0.15 },
      { offset: 1, opacity: 1 },
    ];
    return motion(frames, opts, { duration: 1200 });
  },

  travel(path: readonly Point[], opts: MotionOptions = {}): Motion {
    // Offsets are relative to path[0], where the shape was drawn.
    const origin = pointAt(path, 0);
    const total = polylineLength(path) || 1;
    let run = 0;

    const frames = path.map((p, i): MotionFrame => {
      if (i) run += dist(pointAt(path, i - 1), p);
      return { offset: run / total, x: p[0] - origin[0], y: p[1] - origin[1] };
    });

    return motion(frames, opts, { duration: 2000, easing: 'linear' });
  },
};
