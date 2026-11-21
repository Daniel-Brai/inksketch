import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createRng,
  poses,
  presets,
  sketch,
  tones,
  type Point,
  type Rng,
  type Sketch,
} from 'inksketch';
import {
  buildProject,
  buildScene,
  COMPONENTS,
  type ElementDoc,
  type ProjectDoc,
} from 'inksketch/document';

import { scanTags } from '#/xml.ts';

type Maker = (rng: Rng) => Sketch;

const PER_TYPE = Number(process.env.PER_TYPE ?? 100);
const OUT = join(import.meta.dirname, 'out');
// Object.keys widens to string[] and these names feed typed options.
const STYLE_NAMES = Object.keys(presets) as Array<keyof typeof presets>;
const POSE_NAMES = Object.keys(poses) as Array<keyof typeof poses>;

const WORDS = [
  'api',
  'cache',
  'queue',
  'user',
  'db',
  'worker',
  'auth',
  'cdn',
  'model',
  'idea',
  'ünïcödé',
  'emoji 🎨',
  'a→b',
  '(x+y)²',
  '',
];

const point = (rng: Rng, w = 800, h = 500): Point => [rng.range(20, w - 20), rng.range(20, h - 20)];

function base(rng: Rng, extra: Partial<Parameters<typeof sketch>[0]> = {}): Sketch {
  return sketch({
    width: rng.int(200, 1400),
    height: rng.int(150, 900),
    style: rng.pick(STYLE_NAMES),
    seed: rng.int(0, 1e9),
    background: rng.pick(['none', 'paper', 'ink', '#fafafa']),
    texture: rng.chance(0.3) ? rng.next() : false,
    vignette: rng.chance(0.2),
    draw: rng.chance(0.5),
    ...extra,
  });
}

function wildPose(rng: Rng) {
  const limb = () => [rng.range(-400, 400), rng.range(-400, 400)] as const;

  return {
    view: rng.pick(['side', 'front'] as const),
    lean: rng.range(-200, 200),
    tilt: rng.range(-200, 200),
    armBack: limb(),
    armFront: limb(),
    legBack: limb(),
    legFront: limb(),
  };
}

function randomPathData(rng: Rng): string {
  const commands = 'MmLlHhVvCcSsQqTtAaZz';

  return Array.from({ length: rng.int(1, 30) }, () => {
    const command = commands[rng.int(0, commands.length - 1)];
    const numbers = Array.from({ length: 7 }, () => rng.range(-200, 200).toFixed(rng.int(0, 3)));

    return `${command}${numbers.join(rng.pick([' ', ',', '']))}`;
  }).join('');
}

function randomIcon(rng: Rng): string {
  const rotation = rng.int(0, 360);
  const scale = rng.range(0.2, 2);
  const rectWidth = rng.range(-5, 20);
  const circleRadius = rng.range(-2, 6);

  const shapes = [
    '<path d="M3 12a9 9 0 1018 0 9 9 0 10-18 0z"/>',
    `<rect x="4" y="4" width="${rectWidth}" height="8" rx="2"/>`,
    `<circle cx="12" cy="12" r="${circleRadius}"/>`,
    '<polygon points="1,1 5,9 9 1"/>',
    '<line x1="0" y1="0" x2="24" y2="24"/>',
    '<ellipse cx="5" cy="5" rx="3" ry="1"/>',
  ];

  return [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">',
    '<!-- c -->',
    '<defs><path id="x" d="M0 0L9 9"/></defs>',
    `<g transform="translate(2 2) rotate(${rotation} 12 12) scale(${scale})">`,
    shapes.join(''),
    '</g>',
    '<style>.a{fill:red}</style>',
    '</svg>',
  ].join('');
}

const makers: Record<string, Maker> = {
  diagrams: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    const nodes = Array.from({ length: rng.int(2, 9) }, (_, i) => ({
      id: `n${i}`,
      at: spot(),
      label: rng.pick(WORDS),
      shape: rng.pick(['circle', 'box', 'dot'] as const),
    }));

    s.graph(
      nodes,
      nodes.slice(1).map((n, i) => ({
        from: nodes[i]?.id ?? 'n0',
        to: n.id,
        bend: rng.range(-0.5, 0.5),
        dashed: rng.chance(0.3),
        label: rng.pick(WORDS),
      })),
    );

    s.cylinder(spot(), {
      rx: rng.range(10, 90),
      label: rng.pick(WORDS),
      shade: rng.pick(['none', 'hatch', 'stipple', 'crosshatch', 'solid']),
    });

    s.server(spot(), [rng.range(20, 90), rng.range(30, 120)], {
      units: rng.int(1, 6),
      label: rng.pick(WORDS),
    });

    s.cloud(spot(), [rng.range(40, 260), rng.range(30, 120)], {
      label: rng.pick(WORDS),
    });

    s.document(spot(), [rng.range(30, 120), rng.range(40, 160)], {
      title: rng.pick(WORDS),
    });

    s.brace(spot(), spot());

    return s;
  },
  people: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    for (let i = 0; i < rng.int(1, 6); i++) {
      const pose = rng.chance(0.3) ? wildPose(rng) : rng.pick(POSE_NAMES);

      s.person(spot(), {
        height: rng.range(15, 400),
        pose,
        look: rng.pick(['solid', 'outline', 'ghost']),
        body: rng.pick(['neutral', 'masculine', 'feminine', 'child']),
        outfit: rng.pick(['trousers', 'skirt', 'dress', 'coat']),
        hair: rng.pick(['none', 'short', 'long', 'bun', 'ponytail']),
        prop: rng.pick(['sign', 'briefcase', 'phone', 'umbrella', 'ball']),
        propText: rng.pick(WORDS),
        facing: rng.chance(0.5) ? 1 : -1,
        rendering: rng.chance(0.2) ? 'mechanical' : 'drawn',
        build: rng.range(0.6, 1.6),
      });

      s.stickFigure(spot(), { height: rng.range(10, 200), pose });
    }

    return s;
  },
  animation: (rng) => {
    const draw = rng.chance(0.5) ? { loop: rng.chance(0.5), holdMs: rng.int(0, 4000) } : true;
    const s = base(rng, { draw, boil: rng.chance(0.3) });
    const spot = (): Point => point(rng, s.width, s.height);

    s.walker(spot(), {
      look: rng.pick(['solid', 'outline', 'ghost']),
      height: rng.range(30, 200),
      distance: rng.range(-600, 600),
      route: rng.chance(0.4) ? Array.from({ length: rng.int(2, 6) }, () => spot()) : undefined,
      arms: rng.chance(0.3) ? 'holdSign' : undefined,
      prop: rng.chance(0.3) ? 'sign' : undefined,
    });

    s.stone(spot(), rng.range(5, 80)).bounce({ height: rng.range(5, 200) });

    s.gear(spot(), rng.range(10, 80), { teeth: rng.int(3, 30) }).spin({
      turns: rng.range(-3, 3),
    });

    s.lightbulb(spot(), rng.range(8, 60)).pulse().delay(rng.int(0, 3000));

    s.morph(
      Array.from({ length: 8 }, () => spot()),
      Array.from({ length: rng.int(3, 30) }, () => spot()),
      { frames: rng.int(2, 40), closed: rng.chance(0.5) },
    );

    s.frames(rng.int(1, 30), (sk, i) => sk.circle(spot(), 5 + i), {
      fps: rng.int(1, 30),
      once: rng.chance(0.5),
    });

    return s;
  },
  nature: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    s.tree(spot(), rng.range(20, 500), {
      depth: rng.int(1, 12),
      leaves: rng.pick(['none', 'dots', 'loops', 'leaves', 'blossoms']),
      spreadDeg: rng.range(0, 90),
    });

    s.roots(spot(), rng.range(10, 300));

    s.plant(spot(), rng.range(20, 300), {
      leaves: rng.int(0, 14),
      pot: rng.chance(0.7),
    });

    s.leaf(spot(), rng.range(3, 200), {
      angleDeg: rng.range(-360, 360),
      shade: rng.pick(['contour', 'hatch', 'none']),
    });

    s.sun(spot(), rng.range(3, 80), { rays: rng.int(0, 40) });
    s.waves(spot(), rng.range(0, 1200), { rows: rng.int(1, 12) });

    s.grass(spot(), spot(), {
      density: rng.range(0, 8),
      height: rng.range(1, 80),
    });

    return s;
  },
  textures: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    const box = {
      x: rng.range(0, 200),
      y: rng.range(0, 200),
      w: rng.range(1, 600),
      h: rng.range(1, 400),
    };

    const poly: Point[] = Array.from({ length: rng.int(3, 12) }, () => spot());

    const field = rng.pick([
      tones.linear(point(rng), point(rng)),
      tones.radial(point(rng), rng.range(1, 400)),
      tones.noise({ seed: rng.int(0, 999), scale: rng.range(2, 200), octaves: rng.int(1, 8) }),
      tones.constant(rng.range(-1, 2)),
    ]);

    s.toneStipple(poly, field, { density: rng.range(0, 20) });
    s.toneHatch(poly, field, { layers: rng.int(0, 6), gap: rng.range(0.1, 12) });
    s.pebbles(box, { minR: rng.range(1, 20), maxR: rng.range(2, 40) });
    s.cracks(box, { cells: rng.int(0, 800) });
    s.logEnd(spot(), rng.range(2, 120), { rings: rng.int(0, 50) });

    s.polygon(poly, {
      fill: rng.pick(['hatch', 'crosshatch', 'stipple', 'solid', 'paper', 'wash', 'none']),
    });

    return s;
  },
  lettering: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?-_+=*/\\|#%<>()[]{}\'"’→←↑↓~&@$\n\tÀçñ中文🎨';

    for (let i = 0; i < rng.int(1, 6); i++) {
      const text = Array.from(
        { length: rng.int(0, 60) },
        () => chars[rng.int(0, chars.length - 1)],
      ).join('');

      s.text(spot(), text, {
        size: rng.range(1, 120),
        anchor: rng.pick(['start', 'middle', 'end']),
        lettering: rng.pick(['hand', 'font']),
        rotateDeg: rng.range(-180, 180),
        slantDeg: rng.range(-30, 30),
        color: rng.pick(['ink', 'accent', { light: '#123456', dark: '#abcdef' }]),
      });
    }

    return s;
  },
  crowds: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);

    const shape = rng.pick([
      { type: 'ring' as const, center: spot(), r: rng.range(0, 400) },
      {
        type: 'disk' as const,
        center: spot(),
        r: rng.range(0, 400),
        falloff: rng.range(0, 5),
      },
      {
        type: 'rect' as const,
        at: spot(),
        size: [rng.range(0, 600), rng.range(0, 400)] as const,
      },
      {
        type: 'line' as const,
        from: spot(),
        to: spot(),
      },
      {
        type: 'points' as const,
        points: Array.from({ length: rng.int(1, 6) }, () => spot()),
      },
    ]);

    s.swarm({
      shape,
      count: rng.int(0, 25000),
      kind: rng.pick(['dot', 'figure', 'mix']),
      size: rng.range(0.1, 30),
      motion: rng.pick(['none', 'drift', 'orbit', 'breathe', 'shimmer']),
      groups: rng.int(0, 40),
      perspective: rng.chance(0.5),
    });

    return s;
  },
  imports: (rng) => {
    const s = base(rng);
    const spot = (): Point => point(rng, s.width, s.height);
    const pathData = randomPathData(rng);
    const icon = randomIcon(rng);
    const garbage = ['', '<svg>', '<<<>>>', '<svg viewBox="0 0 0 0"><path d="M"/></svg>'];

    const drawPath = () => s.path(`M0 0${pathData}`, { at: spot(), scale: rng.range(0.1, 3) });

    const traceIcon = () =>
      s.trace(icon, { at: spot(), size: [rng.range(10, 300), rng.range(10, 300)] });

    const traceGarbage = () => s.trace(rng.pick(garbage));

    for (const attempt of [drawPath, traceIcon, traceGarbage]) {
      try {
        attempt();
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('inksketch:')) throw error;
      }
    }

    return s;
  },
  combined: (rng) => {
    const palette = {
      light: { ink: '#1f2a44', accent: '#e11d48' },
      dark: { ink: '#e5e7eb', accent: '#fb7185' },
    };

    const s = base(rng, { palette });
    const spot = (): Point => point(rng, s.width, s.height);

    for (let i = 0; i < rng.int(3, 10); i++) {
      s.withStyle(rng.pick(STYLE_NAMES), () => {
        const color = {
          light: `#${rng.int(0, 0xffffff).toString(16).padStart(6, '0')}`,
          dark: '#eeeeee',
        };

        const drawRect = () =>
          s.rect(spot(), [rng.range(5, 300), rng.range(5, 200)], {
            fill: rng.pick(['wash', 'hatch', 'paper']),
            color,
            radius: rng.range(0, 40),
            pressure: rng.range(0, 1),
          });

        const drawCircle = () =>
          s.circle(spot(), rng.range(2, 150), {
            fill: { type: 'wash', color, opacity: rng.next() },
          });

        const drawArrow = () =>
          s.arrow(spot(), spot(), {
            bend: rng.range(-1, 1),
            head: rng.pick(['open', 'filled', 'dot', 'none']),
            tail: rng.pick(['open', 'filled', 'dot', 'none']),
            dashed: rng.chance(0.3),
            color: 'accent',
          });

        const drawPerson = () =>
          s.person(spot(), {
            height: rng.range(30, 200),
            look: rng.pick(['solid', 'outline', 'ghost']),
            color,
          });

        const drawLabel = () => s.label(spot(), rng.pick(WORDS), { color, size: rng.range(8, 40) });

        const drawCube = () =>
          s.cube(spot(), rng.range(10, 150), {
            shade: rng.pick(['hatch', 'stipple', 'crosshatch', 'solid', 'none']),
            color,
          });

        const draw = rng.pick([drawRect, drawCircle, drawArrow, drawPerson, drawLabel, drawCube]);

        draw();
      });
    }

    return s;
  },
};

const EASINGS = [
  'linear',
  'ease',
  'ease-in-out',
  'step-end',
  'cubic-bezier(.2,.8,.2,1)',
  'garbage',
];

const MOTION_PRESETS = [
  'bounce',
  'float',
  'pulse',
  'spin',
  'wiggle',
  'sway',
  'blink',
  'fadeIn',
  'pop',
  'unknown',
];

function randomPropTracks(rng: Rng, def: (typeof COMPONENTS)[number]): ElementDoc['propTracks'] {
  const propTracks: ElementDoc['propTracks'] = {};
  const numberField = def.fields.find((field) => field.type === 'number');

  if (def.fields.some((field) => field.type === 'pose') && rng.chance(0.6)) {
    propTracks.pose = Array.from({ length: rng.int(1, 4) }, () => ({
      atMs: rng.int(0, 4000),
      value: rng.pick(POSE_NAMES),
    }));
  }

  if (numberField && numberField.type === 'number' && rng.chance(0.5)) {
    propTracks[numberField.key] = [
      { atMs: rng.int(0, 1000), value: numberField.min },
      { atMs: rng.int(1000, 4000), value: numberField.max },
    ];
  }

  return propTracks;
}

function randomTracks(rng: Rng): ElementDoc['tracks'] {
  if (!rng.chance(0.6)) return {};

  const slide = {
    atMs: rng.int(1, 5000),
    value: rng.range(0, 800),
    easing: rng.pick(EASINGS),
  };

  return {
    x: [{ atMs: 0, value: 0 }, slide],
    opacity: [
      { atMs: 100, value: 0 },
      { atMs: 900, value: 1 },
    ],
  };
}

function randomMotion(rng: Rng): ElementDoc['motion'] {
  if (!rng.chance(0.3)) return null;

  return {
    preset: rng.pick(MOTION_PRESETS),
    options: { duration: rng.int(100, 4000) },
  };
}

function randomElement(rng: Rng, depth: number): ElementDoc {
  const def = rng.pick(COMPONENTS);
  const propTracks = randomPropTracks(rng, def);

  const color = rng.chance(0.3) ? { light: '#333', dark: '#ddd' } : null;
  const component = rng.chance(0.05) ? 'nonexistent' : def.id;

  const element: ElementDoc = {
    id: `e${rng.int(0, 1e9)}`,
    name: def.label,
    component,
    props: { ...def.defaults, color },
    x: rng.range(0, 800),
    y: rng.range(0, 500),
    rotate: rng.range(-180, 180),
    scale: rng.range(0.1, 3),
    opacity: rng.next(),
    style: rng.chance(0.4) ? rng.pick(STYLE_NAMES) : null,
    draw: rng.chance(0.6) ? { startMs: rng.int(0, 3000), durationMs: rng.int(0, 3000) } : null,
    visible: { fromMs: rng.int(0, 1000), toMs: rng.chance(0.5) ? rng.int(1000, 6000) : null },
    tracks: randomTracks(rng),
    propTracks,
    motion: randomMotion(rng),
    hidden: rng.chance(0.05),
    locked: false,
    children: [],
  };

  if (depth > 0 && rng.chance(0.3)) element.children = [randomElement(rng, depth - 1)];

  return element;
}

function randomScene(rng: Rng, index: number): ProjectDoc['scenes'][number] {
  return {
    id: `s${index}`,
    name: `scene ${index}`,
    durationMs: rng.int(500, 6000),
    fps: rng.int(1, 30),
    background: rng.pick(['none', 'paper', '#ffffff']),
    texture: rng.next(),
    vignette: rng.next(),
    seed: `seed${rng.int(0, 1e6)}`,
    style: rng.pick(STYLE_NAMES),
    transition: { kind: rng.pick(['cut', 'fade'] as const), durationMs: rng.int(0, 1500) },
    elements: Array.from({ length: rng.int(0, 8) }, () => randomElement(rng, 2)),
  };
}

export function documentMaker(rng: Rng): { project: ProjectDoc; scene: number } {
  const scenes = Array.from({ length: rng.int(1, 4) }, (_, index) => randomScene(rng, index));

  const project: ProjectDoc = {
    version: 1,
    id: 'p',
    title: 't',
    width: rng.int(200, 1400),
    height: rng.int(150, 900),
    palette: {},
    scenes,
  };

  return { project, scene: rng.int(0, scenes.length - 1) };
}

const BAD_TOKENS = ['NaN', 'undefined', 'Infinity', '[object'];

function problems(svg: string): string | null {
  const bad = BAD_TOKENS.find((t) => svg.includes(t));

  if (bad) return `contains ${bad}`;

  let depth = 0;

  for (const tag of scanTags(svg)) {
    if (tag.selfClosing) continue;

    depth += tag.closing ? -1 : 1;
  }

  if (depth !== 0) return `unbalanced tags (${depth})`;

  if (svg.length > 12_000_000) return `too large (${(svg.length / 1e6).toFixed(1)} MB)`;

  return null;
}

interface Stat {
  ok: number;
  failures: string[];
  ms: number[];
  kb: number[];
  sample: string[];
}

function run(name: string, render: (rng: Rng) => string[]): Stat {
  const stat: Stat = { ok: 0, failures: [], ms: [], kb: [], sample: [] };

  for (let i = 0; i < PER_TYPE; i++) {
    const seed = `${name}:${i}`;
    const started = performance.now();

    try {
      const outputs = render(createRng(seed));
      const elapsed = performance.now() - started;
      const issue = outputs.map(problems).find((p) => p !== null);

      if (issue) {
        stat.failures.push(`${seed}: ${issue}`);
      } else {
        stat.ok += 1;
      }

      stat.ms.push(elapsed);
      stat.kb.push(Math.max(...outputs.map((o) => o.length)) / 1024);

      if (i < 4) stat.sample.push(outputs[0] ?? '<svg/>');
    } catch (error) {
      stat.failures.push(
        `${seed}: threw ${error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : String(error)}`,
      );
    }
  }

  return stat;
}

const pct = (values: number[], p: number): number =>
  values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0;

const SHEET_STYLE = [
  'body{font:12px system-ui;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;',
  'padding:8px;background:#ddd}',
  'figure{margin:0;background:#fff;padding:4px}',
  'svg{width:100%;height:auto;display:block}',
].join('');

function sketchRenders(rng: Rng, make: Maker): string[] {
  const drawing = make(rng);

  return [
    drawing.toSVG({ theme: rng.pick(['auto', 'light', 'dark', 'inherit']) }),
    drawing.toSVG({ time: rng.range(0, 8000) }),
    drawing.toSVG({ static: true }),
  ];
}

function documentRenders(rng: Rng): string[] {
  const { project, scene } = documentMaker(rng);
  const single = buildScene(project, scene);
  const movie = buildProject(project);

  return [
    single.toSVG(),
    single.toSVG({ time: rng.range(0, 6000) }),
    movie.toSVG(),
    movie.toSVG({ time: rng.range(0, 20000) }),
  ];
}

function summaryRow(name: string, stat: Stat): string {
  const passed = `${String(stat.ok).padStart(3)}/${PER_TYPE}`;
  const median = pct(stat.ms, 0.5).toFixed(0).padStart(5);
  const slow = pct(stat.ms, 0.95).toFixed(0).padStart(5);

  const biggest = Math.max(0, ...stat.kb)
    .toFixed(0)
    .padStart(6);

  return `${name.padEnd(10)} ${passed}  p50 ${median}ms  p95 ${slow}ms  max ${biggest}KB`;
}

function contactSheet(results: Array<[string, Stat]>): string {
  const figures = results.flatMap(([name, stat]) =>
    stat.sample.map((svg, i) => `<figure><figcaption>${name} ${i}</figcaption>${svg}</figure>`),
  );

  return `<!doctype html><meta charset="utf-8"><style>${SHEET_STYLE}</style>${figures.join('')}`;
}

function main(): void {
  mkdirSync(OUT, { recursive: true });

  const results: Array<[string, Stat]> = [];

  for (const [name, make] of Object.entries(makers)) {
    results.push([name, run(name, (rng) => sketchRenders(rng, make))]);
  }

  results.push(['documents', run('documents', documentRenders)]);

  console.log(results.map(([name, stat]) => summaryRow(name, stat)).join('\n'));

  for (const [name, stat] of results) {
    for (const failure of stat.failures.slice(0, 4)) console.log(`  ✗ [${name}] ${failure}`);
  }

  writeFileSync(join(OUT, 'contact-sheet.html'), contactSheet(results));

  process.exitCode = results.some(([, stat]) => stat.failures.length) ? 1 : 0;
}

if (import.meta.main) main();
