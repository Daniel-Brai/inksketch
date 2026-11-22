import {
  drawStyle,
  FADE_CLASS,
  flipbookStyle,
  isActiveFrame,
  motionStyle,
  sharedDrawCss,
  windowStyle,
  type DrawStyle,
} from './animation-styles.ts';
import { brushOutline } from './brush.ts';
import { EMBEDDED_PLAYER } from './embedded-player.ts';
import { dotsPath, f, pathData } from './geometry.ts';
import { KeyframeRegistry } from './keyframes.ts';
import { MAX_BOIL_FRAMES } from './limits.ts';
import type { DotsNode, FillNode, GroupNode, SceneNode, StrokeNode, TextNode } from './model.ts';
import type { DrawConfig } from './options.ts';
import { createRng, hashSeed, type Rng } from './random.ts';
import type {
  EmbeddedFont,
  LoopTiming,
  RenderContext,
  RenderOptions,
  Timeline,
} from './render.types.ts';
import { flipbookIndexAt } from './sampling.ts';
import type { Sketch } from './sketch.ts';
import { handLine } from './stroke.ts';
import type { Palette } from './style.ts';
import { schedule } from './timeline.ts';

const SID = '__IKSID__';

const EMPTY_TIMELINE: Timeline = { times: new Map(), ends: new Map(), total: 0 };

const esc = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function present(list: Array<string | null>): string[] {
  return list.filter((a) => a !== null);
}

function attrs(list: Array<string | null>): string {
  return present(list).join(' ');
}

function numberAttr(name: string, value: number | undefined): string | null {
  if (value === undefined) return null;

  return `${name}="${f(value)}"`;
}

function styleAttr(style: string | null): string | null {
  if (style === null) return null;

  return `style="${style}"`;
}

function drawAttrs(draw: DrawStyle | null): Array<string | null> {
  if (draw === null) return [];

  return [draw.className === null ? null : `class="${draw.className}"`, `style="${draw.style}"`];
}

function renderStroke(node: StrokeNode, ctx: RenderContext): string {
  const rng = createRng(`${ctx.seed}:${node.id}:${ctx.frame}`);
  const drawOn = node.dash === undefined;
  const style = drawStyle(ctx, node.id, drawOn ? 'draw' : 'fade');
  const closeWithZ = node.closed && node.feel.roughness <= 0;

  const shared = present([
    node.color === 'var(--ik-ink)' ? null : `stroke="${node.color}"`,
    node.cap === 'round' ? null : `stroke-linecap="${node.cap}"`,
    numberAttr('stroke-opacity', node.opacity),
    node.dash ? `stroke-dasharray="${node.dash.map(f).join(' ')}"` : null,
    style !== null && drawOn ? 'pathLength="1"' : null,
    ...drawAttrs(style),
  ]);

  if (node.pressure > 0) return renderBrush(node, { rng, style });

  const pass = (salt: number, width: number): string => {
    const pts = handLine(node.points, node.closed, node.feel, salt ? rng.fork(salt) : rng);

    const list = [
      `d="${pathData(pts, node.smooth, closeWithZ)}"`,
      `stroke-width="${f(width)}"`,
      ...shared,
    ];

    return `<path ${attrs(list)}/>`;
  };

  const passes = [pass(0, node.width)];

  if (node.feel.roughness > 0) {
    for (let p = 1; p <= node.passes; p++) {
      passes.push(`<g opacity="${f(node.passOpacity)}">${pass(p, node.width * 0.7)}</g>`);
    }
  }

  return passes.join('');
}

function renderBrush(node: StrokeNode, o: { rng: Rng; style: DrawStyle | null }): string {
  const pts = handLine(node.points, node.closed, node.feel, o.rng);

  const outline = brushOutline(pts, {
    width: node.width * 1.15,
    pressure: node.pressure,
    rng: o.rng.fork('brush'),
  });

  const fade =
    o.style === null || o.style.className === null
      ? o.style
      : { className: FADE_CLASS, style: o.style.style };

  const list = [
    `d="${pathData(outline, true, true)}"`,
    `fill="${node.color}"`,
    'stroke="none"',
    numberAttr('fill-opacity', node.opacity),
    ...drawAttrs(fade),
  ];

  return `<path ${attrs(list)}/>`;
}

function renderFill(node: FillNode, ctx: RenderContext): string {
  const rng = createRng(`${ctx.seed}:${node.id}:${ctx.frame}`);
  const pts = handLine(node.points, true, { ...node.feel, overshoot: 0 }, rng);

  const list = [
    `d="${pathData(pts, node.feel.roughness > 0, true)}"`,
    `fill="${node.color}"`,
    'stroke="none"',
    numberAttr('fill-opacity', node.opacity),
    ...drawAttrs(drawStyle(ctx, node.id, 'fade')),
  ];

  return `<path ${attrs(list)}/>`;
}

function renderDots(node: DotsNode, ctx: RenderContext): string | null {
  if (!node.points.length) return null;

  const list = [
    `d="${dotsPath(node.points)}"`,
    node.color === 'var(--ik-ink)' ? null : `stroke="${node.color}"`,
    `stroke-width="${f(node.size)}"`,
    numberAttr('stroke-opacity', node.opacity),
    ...drawAttrs(drawStyle(ctx, node.id, 'fade')),
  ];

  return `<path ${attrs(list)}/>`;
}

function textBody(text: string): string {
  const lines = text.split('\n');

  if (lines.length === 1) return esc(text);

  return lines
    .map((line, i) => `<tspan x="0" dy="${i ? '1.3em' : '0'}">${esc(line)}</tspan>`)
    .join('');
}

function renderText(node: TextNode, ctx: RenderContext): string {
  const list = [
    `font-family="${esc(node.font)}"`,
    `font-size="${f(node.size)}"`,
    `font-weight="${node.weight}"`,
    `text-anchor="${node.anchor}"`,
    `fill="${node.color}"`,
    'stroke="none"',
    numberAttr('fill-opacity', node.opacity),
    ...drawAttrs(drawStyle(ctx, node.id, 'fade')),
  ];
  return `<text ${attrs(list)}>${textBody(node.text)}</text>`;
}

function transformAttr(node: GroupNode): string | null {
  const t = node.transform;

  if (!t) return null;

  const parts: string[] = [];

  if (t.x || t.y) parts.push(`translate(${f(t.x ?? 0)} ${f(t.y ?? 0)})`);

  if (t.rotate) parts.push(`rotate(${f(t.rotate)})`);

  if (t.scale !== undefined && t.scale !== 1) parts.push(`scale(${f(t.scale)})`);

  if (!parts.length) return null;

  return `transform="${parts.join(' ')}"`;
}

function groupStyle(node: GroupNode, ctx: RenderContext): string | null {
  const parts: string[] = [];

  if (node.blur) parts.push(`filter:blur(${f(node.blur)}px)`);

  if (node.frame && !ctx.still && ctx.time === null) {
    const flip = flipbookStyle(ctx.keyframes, node.frame);
    if (flip !== null) parts.push(flip);
  }

  if (!parts.length) return null;

  return styleAttr(parts.join(';'));
}

function hiddenAt(node: GroupNode, ctx: RenderContext): boolean {
  if (ctx.still && node.frame && node.frame.index > 0) return true;

  if (ctx.time === null) return false;

  if (node.frame && !isActiveFrame(node.frame, ctx.time)) return true;

  if (!node.window) return false;

  return (
    ctx.time < node.window.fromMs || (node.window.toMs !== null && ctx.time >= node.window.toMs)
  );
}

function renderGroup(node: GroupNode, ctx: RenderContext): string | null {
  if (hiddenAt(node, ctx)) return null;

  const children = node.children.map((child) => renderNode(child, ctx)).filter((c) => c !== null);

  if (!children.length) return null;

  let inner = children.join('');

  if (!ctx.still) {
    for (const m of node.motions.toReversed()) {
      inner = `<g style="${motionStyle(ctx, m, node.id)}">${inner}</g>`;
    }
  }

  const list = present([
    transformAttr(node),
    numberAttr('opacity', node.opacity),
    groupStyle(node, ctx),
  ]);

  const group = list.length ? `<g ${list.join(' ')}>${inner}</g>` : inner;

  if (!node.window || ctx.still || ctx.time !== null) return group;

  return `<g style="${windowStyle(ctx.keyframes, node.window)}">${group}</g>`;
}

function renderNode(node: SceneNode, ctx: RenderContext): string | null {
  switch (node.kind) {
    case 'stroke':
      return renderStroke(node, ctx);
    case 'fill':
      return renderFill(node, ctx);
    case 'dots':
      return renderDots(node, ctx);
    case 'text':
      return renderText(node, ctx);
    case 'raw':
      return node.svg;
    case 'use':
      return `<use href="#${ctx.sid}-${node.ref}"/>`;
    case 'group':
      return renderGroup(node, ctx);
  }
}

function colorValues(s: Sketch, mode: 'light' | 'dark'): Array<[string, string]> {
  const p: Palette = s.palettes[mode];

  const named: Array<[string, string]> = [
    ['--ik-ink', p.ink],
    ['--ik-paper', p.paper],
    ['--ik-muted', p.muted],
    ['--ik-accent', p.accent],
  ];

  return [...named, ...s.colors.variables().map((v): [string, string] => [v.name, v[mode]])];
}

function inlineColors(svg: string, s: Sketch, theme: NonNullable<RenderOptions['theme']>): string {
  if (theme !== 'light' && theme !== 'dark') return svg;

  let out = svg;

  for (const [name, value] of colorValues(s, theme)) out = out.replaceAll(`var(${name})`, value);

  return out;
}

function paletteVars(s: Sketch, mode: 'light' | 'dark'): string {
  return colorValues(s, mode)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

const INHERIT_VARS = [
  '--ik-ink:var(--ik-theme-ink,currentColor)',
  '--ik-paper:var(--ik-theme-paper,Canvas)',
  '--ik-muted:var(--ik-theme-muted,color-mix(in srgb,currentColor 45%,transparent))',
  '--ik-accent:var(--ik-theme-accent,currentColor)',
].join(';');

function themedOnly(s: Sketch, mode: 'light' | 'dark'): string {
  return s.colors
    .variables()
    .map((v) => `${v.name}:${v[mode]}`)
    .join(';');
}

function reactiveCss(
  sid: string,
  vars: { light: string; dark: string },
  opts: RenderOptions,
): string {
  const darkHost = opts.darkSelector ?? '[data-theme="dark"]';
  const lightHost = opts.lightSelector ?? '[data-theme="light"]';

  return [
    `.${sid}{${vars.light}}`,
    `@media (prefers-color-scheme:dark){.${sid}{${vars.dark}}}`,
    `${darkHost} .${sid}{${vars.dark}}`,
    `${lightHost} .${sid}{${vars.light}}`,
  ].join('');
}

function themeCss(s: Sketch, opts: RenderOptions, sid: string): string {
  const theme = opts.theme ?? 'auto';

  switch (theme) {
    case 'light':
    case 'dark':
      return `.${sid}{${paletteVars(s, theme)}}`;
    case 'auto':
      return reactiveCss(
        sid,
        { light: paletteVars(s, 'light'), dark: paletteVars(s, 'dark') },
        opts,
      );
    case 'inherit':
      return (
        `.${sid}{${INHERIT_VARS}}` +
        reactiveCss(sid, { light: themedOnly(s, 'light'), dark: themedOnly(s, 'dark') }, opts)
      );
  }
}

function fontFace(font: EmbeddedFont): string {
  const format = font.format ?? 'woff2';
  const mime = format === 'truetype' ? 'ttf' : format;
  const isUrl = ['http:', 'https:', '/', '.'].some((prefix) => font.src.startsWith(prefix));
  const src = isUrl ? font.src : `data:font/${mime};base64,${font.src}`;

  return `@font-face{font-family:'${font.family}';src:url(${src}) format('${format}');font-weight:${font.weight ?? 'normal'};font-style:${font.style ?? 'normal'}}`;
}

function triggerCss(sid: string, trigger: NonNullable<RenderOptions['trigger']>): string | null {
  if (trigger === 'hover') return `.${sid}:not(:hover) *{animation:none!important}`;

  if (trigger === 'load') return null;

  return `.${sid}.ik-paused *{animation-play-state:paused!important}`;
}

function strength(value: boolean | number | undefined): number {
  if (value === true) return 0.5;

  if (typeof value === 'number') return value;

  return 0;
}

function backgroundLayers(s: Sketch, sid: string): { defs: string[]; layers: string[] } {
  const o = s.options;
  const size = `width="${s.width}" height="${s.height}"`;
  const vignette = strength(o.vignette);
  const grain = strength(o.texture);
  const defs: string[] = [];
  const layers: string[] = [];

  if (o.background && o.background !== 'none') {
    layers.push(`<rect ${size} stroke="none" fill="${s.color(o.background)}"/>`);
  }

  if (vignette > 0) {
    defs.push(
      `<radialGradient id="${sid}-vig" cx="50%" cy="50%" r="75%"><stop offset="45%" stop-color="var(--ik-ink)" stop-opacity="0"/><stop offset="100%" stop-color="var(--ik-ink)" stop-opacity="${f(vignette * 0.45)}"/></radialGradient>`,
    );

    layers.push(`<rect ${size} stroke="none" fill="url(#${sid}-vig)"/>`);
  }

  if (grain > 0) {
    const seed = hashSeed(String(s.seed)) % 1000;

    defs.push(
      `<filter id="${sid}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 1.1"/></filter>`,
    );

    layers.push(
      `<rect ${size} stroke="none" fill="var(--ik-ink)" filter="url(#${sid}-grain)" opacity="${f(grain * 0.16)}"/>`,
    );
  }

  return { defs, layers };
}

function loopTiming(config: DrawConfig | null, timeline: Timeline): LoopTiming | null {
  if (!config?.loop || timeline.total <= 0) return null;

  const hold = timeline.total + (config.holdMs ?? 2500);

  return { hold, cycle: hold + 700 };
}

function drawConfig(s: Sketch, still: boolean): DrawConfig | null {
  const draw = s.options.draw;

  if (!draw || still) return null;

  if (draw === true) return {};

  return draw;
}

function boilConfig(s: Sketch, blocked: boolean): { frames: number; fps: number } | null {
  const boil = s.options.boil;

  if (!boil || blocked) return null;

  const spec = boil === true ? {} : boil;

  return { frames: Math.min(MAX_BOIL_FRAMES, Math.max(2, spec.frames ?? 3)), fps: spec.fps ?? 6 };
}

function accessibility(s: Sketch, sid: string): { markup: string[]; attr: string } {
  const { title, description } = s.options;
  const markup = description ? [`<desc id="${sid}-desc">${esc(description)}</desc>`] : [];

  if (!title && !description) return { markup, attr: 'aria-hidden="true"' };

  const parts = ['role="img"'];

  if (title) parts.push(`aria-label="${esc(title)}"`);

  if (description) parts.push(`aria-describedby="${sid}-desc"`);

  return { markup, attr: parts.join(' ') };
}

function rootAttributes(s: Sketch, opts: RenderOptions, sid: string): string {
  const trigger = opts.trigger ?? 'load';
  const paused = trigger === 'visible' || trigger === 'click';

  return attrs([
    'xmlns="http://www.w3.org/2000/svg"',
    `viewBox="0 0 ${s.width} ${s.height}"`,
    `width="${s.width}"`,
    `height="${s.height}"`,
    paused ? `class="ik ${sid} ik-paused"` : `class="ik ${sid}"`,
    accessibility(s, sid).attr,
    paused ? `data-ik-trigger="${trigger}"` : null,
    opts.replay ? 'data-ik-replay="true"' : null,
    opts.responsive === false ? null : 'style="max-width:100%;height:auto"',
    'fill="none"',
    'stroke="var(--ik-ink)"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
  ]);
}

function playerFor(opts: RenderOptions): string | null {
  const trigger = opts.trigger ?? 'load';

  if (opts.static || opts.time !== undefined) return null;

  if (trigger !== 'visible' && trigger !== 'click') return null;

  return `<script><![CDATA[${EMBEDDED_PLAYER}]]></script>`;
}

function renderFrames(s: Sketch, base: Omit<RenderContext, 'frame' | 'animate'>): string {
  const boil = boilConfig(s, base.still || base.loop !== null);
  const drawing = base.timeline !== EMPTY_TIMELINE;

  if (!boil) return renderNode(s.root, { ...base, frame: 0, animate: drawing }) ?? '<g/>';

  const frames: string[] = [];

  if (base.time !== null) {
    const active = flipbookIndexAt(
      { index: 0, count: boil.frames, fps: boil.fps, delay: base.timeline.total, once: false },
      base.time,
    );

    const context = { ...base, frame: active, animate: drawing && active === 0 };

    return renderNode(s.root, context) ?? '<g/>';
  }

  for (let frame = 0; frame < boil.frames; frame++) {
    const context = { ...base, frame, animate: drawing && frame === 0 };
    const body = renderNode(s.root, context) ?? '<g/>';

    const style = flipbookStyle(base.keyframes, {
      index: frame,
      count: boil.frames,
      fps: boil.fps,
      delay: base.timeline.total,
      once: false,
    });

    frames.push(`<g ${attrs([styleAttr(style)])}>${body}</g>`);
  }

  return frames.join('');
}

export function renderSketch(s: Sketch, opts: RenderOptions = {}): string {
  const sid = opts.id ?? SID;
  const still = opts.static ?? false;
  const config = drawConfig(s, still);
  const timeline = config ? schedule(s.root, config) : EMPTY_TIMELINE;
  const keyframes = new KeyframeRegistry(sid);

  const content = renderFrames(s, {
    seed: s.seed,
    still,
    timeline,
    keyframes,
    loop: loopTiming(config, timeline),
    easing: config?.easing ?? 'ease-in-out',
    time: opts.time ?? null,
    sid,
  });

  const reused = [...s.defs.values()].map((def) => {
    const ctx = {
      seed: s.seed,
      still,
      timeline,
      keyframes,
      loop: null,
      easing: 'linear',
      time: opts.time ?? null,
      sid,
      frame: 0,
      animate: false,
    };

    const body = renderNode(def.node, ctx);

    if (body === null) return `<g id="${sid}-${def.ref}"/>`;

    return `<g id="${sid}-${def.ref}">${body}</g>`;
  });

  const css = [
    themeCss(s, opts, sid),
    triggerCss(sid, opts.trigger ?? 'load'),
    `@media (prefers-reduced-motion:reduce){.${sid} *{animation:none!important}}`,
    timeline === EMPTY_TIMELINE || config?.loop
      ? null
      : sharedDrawCss({ keyframes, easing: config?.easing ?? 'ease-in-out' }, sid),
    ...(opts.fonts ?? []).map(fontFace),
    keyframes.toCss(),
  ].filter((rule) => rule !== null);

  const { defs, layers } = backgroundLayers(s, sid);

  defs.push(...reused);

  const label = accessibility(s, sid);

  const parts = [
    `<svg ${rootAttributes(s, opts, sid)}>`,
    ...label.markup,
    `<style>${css.join('')}</style>`,
    defs.length ? `<defs>${defs.join('')}</defs>` : null,
    ...layers,
    content,
    playerFor(opts),
    '</svg>',
  ];

  const svg = parts.filter((p) => p !== null).join('');

  const resolved = inlineColors(svg, s, opts.theme ?? 'auto');

  if (opts.id) return resolved;

  return resolved.split(SID).join(`ik${hashSeed(resolved).toString(36)}`);
}
