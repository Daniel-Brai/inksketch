import type { Box, Point } from './geometry.ts';
import {
  nodeBounds,
  type DrawControl,
  type GroupNode,
  type Motion,
  type MotionFrame,
  type Transform,
} from './model.ts';
import { motion, motions, type MotionOptions } from './motion.ts';
import type { AnchorSide } from './options.ts';

export class Shape {
  readonly node: GroupNode;

  constructor(node: GroupNode) {
    this.node = node;
  }

  get bounds(): Box {
    return nodeBounds(this.node);
  }

  anchor(side: AnchorSide = 'center', gap = 0): Point {
    const b = this.bounds;
    const xs = { left: b.x - gap, mid: b.x + b.w / 2, right: b.x + b.w + gap };
    const ys = { top: b.y - gap, mid: b.y + b.h / 2, bottom: b.y + b.h + gap };

    const table: Record<AnchorSide, Point> = {
      center: [xs.mid, ys.mid],
      top: [xs.mid, ys.top],
      bottom: [xs.mid, ys.bottom],
      left: [xs.left, ys.mid],
      right: [xs.right, ys.mid],
      topLeft: [xs.left, ys.top],
      topRight: [xs.right, ys.top],
      bottomLeft: [xs.left, ys.bottom],
      bottomRight: [xs.right, ys.bottom],
    };

    return table[side];
  }

  animate(m: Motion | MotionFrame[], opts?: MotionOptions): this {
    this.node.motions.push(Array.isArray(m) ? motion(m, opts) : m);
    return this;
  }

  bounce(opts?: Parameters<typeof motions.bounce>[0]): this {
    return this.animate(motions.bounce(opts));
  }

  float(opts?: Parameters<typeof motions.float>[0]): this {
    return this.animate(motions.float(opts));
  }

  pulse(opts?: Parameters<typeof motions.pulse>[0]): this {
    return this.animate(motions.pulse(opts));
  }

  spin(opts?: Parameters<typeof motions.spin>[0]): this {
    return this.animate(motions.spin(opts));
  }

  wiggle(opts?: Parameters<typeof motions.wiggle>[0]): this {
    return this.animate(motions.wiggle(opts));
  }

  sway(opts?: Parameters<typeof motions.sway>[0]): this {
    return this.animate(motions.sway(opts));
  }

  fadeIn(opts?: MotionOptions): this {
    return this.animate(motions.fadeIn(opts));
  }

  pop(opts?: MotionOptions): this {
    return this.animate(motions.pop(opts));
  }

  slideIn(opts?: Parameters<typeof motions.slideIn>[0]): this {
    return this.animate(motions.slideIn(opts));
  }

  blink(opts?: Parameters<typeof motions.blink>[0]): this {
    return this.animate(motions.blink(opts));
  }

  travel(path: readonly Point[], opts?: MotionOptions): this {
    return this.animate(motions.travel(path, opts));
  }

  delay(ms: number): this {
    return this.drawControl({ delay: ms });
  }

  at(ms: number): this {
    return this.drawControl({ at: ms });
  }

  duration(ms: number): this {
    return this.drawControl({ duration: ms });
  }

  together(): this {
    return this.drawControl({ mode: 'together' });
  }

  instant(): this {
    return this.drawControl({ instant: true });
  }

  gap(ms: number): this {
    return this.drawControl({ gap: ms });
  }

  transform(t: Transform): this {
    this.node.transform = { ...this.node.transform, ...t };
    return this;
  }

  opacity(v: number): this {
    this.node.opacity = v;
    return this;
  }

  between(fromMs: number, toMs: number | null = null): this {
    this.node.window = { fromMs, toMs };
    return this;
  }

  blur(px: number): this {
    this.node.blur = px;
    return this;
  }

  private drawControl(patch: DrawControl): this {
    this.node.draw = { ...this.node.draw, ...patch };
    return this;
  }
}
