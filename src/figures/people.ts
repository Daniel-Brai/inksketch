import { dist, type Point } from '#/geometry.ts';
import type { Ink } from '#/options.ts';
import type { Shape } from '#/shape.ts';
import type { Sketch } from '#/sketch.ts';

import { drawnPerson } from './drawn-person.ts';
import { mechanicalPerson } from './mechanical-person.ts';
import { walkCycle, type Pose } from './poses.ts';
import { poseOf, skeleton } from './skeleton.ts';
import type { PersonOptions, StickFigureOptions, WalkerOptions } from './types.ts';

export function stickFigure(s: Sketch, at: Point, o: StickFigureOptions = {}): Shape {
  const height = o.height ?? 70;
  const body = skeleton(poseOf(o.pose), height, o.facing ?? 1);
  const lowest = Math.max(...body.limbs.flat().map((p) => p[1]));
  const place = (p: Point): Point => [at[0] + p[0], at[1] + p[1] - lowest];
  const width = o.width ?? Math.max(1.4, Math.min(s.preset.strokeWidth * 1.1, height / 28));
  const ink: Ink = { ...o, width, overshoot: (o.overshoot ?? s.preset.overshoot) * 0.2 };

  return s.group(() => {
    s.circle(place(body.head), body.headR, { ...ink, fill: o.solidHead ? 'solid' : 'paper' });
    s.line(place(body.neck), place(body.hip), ink);

    for (const limb of body.limbs) s.stroke(limb.map(place), false, ink, true);
  });
}

function withArms(cycle: Pose[], arms: WalkerOptions['arms']): Pose[] {
  if (arms === undefined) return cycle;

  const upper = poseOf(arms);

  return cycle.map((pose) => ({
    ...pose,
    armBack: upper.armBack,
    armFront: upper.armFront,
    lean: (pose.lean + upper.lean) / 2,
    tilt: upper.tilt,
  }));
}

function stepping(
  s: Sketch,
  at: Point,
  o: { figure: WalkerOptions; cycle: Pose[]; facing: 1 | -1 },
): Shape {
  const { look, fps = 12, ...rest } = o.figure;

  const signature = JSON.stringify([rest, look ?? 'stick', o.facing, o.cycle.length]);

  return s.frames(
    o.cycle.length,
    (sk, i) => {
      const frame = sk.reuse(`walk:${signature}:${i}`, (inner) => {
        if (look === undefined) {
          inner.stickFigure([0, 0], { ...rest, facing: o.facing, pose: o.cycle[i] });
        } else {
          inner.person([0, 0], { ...rest, look, facing: o.facing, pose: o.cycle[i] });
        }
      });

      frame.transform({ x: at[0], y: at[1] });
    },
    { fps },
  );
}

function walkRoute(
  s: Sketch,
  route: readonly Point[],
  o: { figure: WalkerOptions; cycle: Pose[] },
): Shape {
  const speed = o.figure.speed ?? (o.figure.height ?? 90) * 1.1;
  let clock = 0;

  return s
    .group(() => {
      for (let i = 1; i < route.length; i++) {
        const from = route[i - 1];
        const to = route[i];

        if (!from || !to) continue;

        const duration = (dist(from, to) / speed) * 1000;
        const facing = to[0] < from[0] ? -1 : 1;
        const leg = stepping(s, from, { figure: o.figure, cycle: o.cycle, facing });
        const last = i === route.length - 1;

        leg.travel([from, to], { duration, delay: clock, iterations: 1, easing: 'linear' });
        leg.between(clock, last ? null : clock + duration);
        clock += duration;
      }
    })
    .instant();
}

export function walker(s: Sketch, at: Point, o: WalkerOptions = {}): Shape {
  const { distance, durationMs, route, arms, ...figure } = o;
  const cycle = withArms(walkCycle(12), arms);

  if (route && route.length > 1) return walkRoute(s, route, { figure, cycle });

  const shape = stepping(s, at, { figure, cycle, facing: figure.facing ?? 1 });

  if (!distance) return shape;

  const frames = [
    { offset: 0, x: 0, opacity: 0 },
    { offset: 0.08, opacity: 1 },
    { offset: 0.92, opacity: 1 },
    { offset: 1, x: distance, opacity: 0 },
  ];

  return shape.animate(frames, {
    duration: durationMs ?? Math.abs(distance) * 25,
    easing: 'linear',
    loop: true,
  });
}

export function person(s: Sketch, at: Point, o: PersonOptions = {}): Shape {
  if (o.rendering === 'mechanical') return mechanicalPerson(s, at, o);

  return drawnPerson(s, at, o);
}
