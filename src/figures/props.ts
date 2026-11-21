import { add, mul, normalize, sub, type Point } from '#/geometry.ts';
import type { Ink } from '#/options.ts';
import type { Sketch } from '#/sketch.ts';

import type { Prop } from './types.ts';

export interface Grip {
  hand: Point;
  forearm: Point;
  height: number;
}

function sign(s: Sketch, grip: Grip, o: { ink: Ink; text: string | null }): void {
  const top: Point = [grip.hand[0], grip.hand[1] - grip.height * 0.42];
  const board: Point = [grip.height * 0.3, grip.height * 0.21];

  s.line([grip.hand[0], grip.hand[1] + grip.height * 0.05], top, { ...o.ink, pressure: 0.4 });

  s.rect([top[0] - board[0] / 2, top[1] - board[1]], board, {
    ...o.ink,
    fill: 'paper',
    pressure: 0.4,
  });

  if (o.text) {
    s.label([top[0], top[1] - board[1] / 2], o.text, { size: board[1] * 0.32, color: o.ink.color });
  }
}

function briefcase(s: Sketch, grip: Grip, ink: Ink): void {
  const size: Point = [grip.height * 0.16, grip.height * 0.12];

  s.rect([grip.hand[0] - size[0] / 2, grip.hand[1] + grip.height * 0.02], size, {
    ...ink,
    fill: 'solid',
    radius: 2,
  });
}

function phone(s: Sketch, grip: Grip, ink: Ink): void {
  const size: Point = [grip.height * 0.025, grip.height * 0.05];
  s.rect([grip.hand[0] - size[0] / 2, grip.hand[1] - size[1]], size, { ...ink, fill: 'solid' });
}

function umbrella(s: Sketch, grip: Grip, ink: Ink): void {
  const top: Point = [grip.hand[0], grip.hand[1] - grip.height * 0.5];
  const r = grip.height * 0.32;

  s.line(grip.hand, top, ink);

  s.arc([top[0], top[1] + r * 0.15], [r, r * 0.55], {
    ...ink,
    fromDeg: 180,
    toDeg: 360,
    fill: 'solid',
  });
}

function ball(s: Sketch, grip: Grip, ink: Ink): void {
  const ahead = normalize(sub(grip.hand, grip.forearm));

  s.circle(add(grip.hand, mul(ahead, grip.height * 0.05)), grip.height * 0.05, {
    ...ink,
    fill: 'paper',
  });
}

export function holdProp(
  s: Sketch,
  prop: Prop,
  o: { grip: Grip; ink: Ink; text: string | null },
): void {
  switch (prop) {
    case 'sign':
      sign(s, o.grip, { ink: o.ink, text: o.text });
      return;
    case 'briefcase':
      briefcase(s, o.grip, o.ink);
      return;
    case 'phone':
      phone(s, o.grip, o.ink);
      return;
    case 'umbrella':
      umbrella(s, o.grip, o.ink);
      return;
    case 'ball':
      ball(s, o.grip, o.ink);
  }
}
