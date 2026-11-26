<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="inksketch logo" />
</p>

<h1 align="center">inksketch</h1>

Draw and animate ideas in a hand-drawn ink style. You write a short TypeScript sketch, and inksketch gives you an SVG with the animation built in. The SVG needs no runtime so it works in any website in an `<img>` or as a file.

What you get:

- Hand-drawn lines with real wobble, overshoot and brush pressure, plus clean geometric and chalk styles.
- Hatching, stipple, watercolor washes and tone fields for detailed pen-and-ink shading.
- People traced from a body shape, with poses held to human anatomy, walk cycles and props.
- Animation as plain CSS. Draw-on, motions, frame-by-frame, keyframe tracks and whole films.
- Colors that follow light and dark themes.
- A CLI, a terminal studio and a live preview in the browser.

> **Status:** early. The API may still change between versions.

## Why I made this

I wanted to draw my ideas not just write them. I sketch whenever I explain something on paper. A few boxes, a person pointing, an arrow, a word scribbled next to it. That quick drawing often says more than a paragraph, and I wanted the same feeling in the things I make online.

The tools I tried didn't fit. Diagram apps look stiff and corporate. Stock illustrations and generated images look like everyone else's. Drawing by hand and scanning works, but it's slow to change and impossible to animate.

That's why I made inksketch based on my own drawings. It's a way to sketch ideas in code and get drawings that still look like a pen made them. It's just code so I can change it, keep it in git and reuse parts across drawings. It can also move when that helps explain the idea. What comes out is a small SVG I can drop anywhere.

## Requirements

- [Bun](https://bun.sh) 1.3 or newer. It runs TypeScript directly, with no build step.

That's all. Bun installs it, runs the CLI, the terminal studio and the preview, and runs the tests.

## Install

Install it from source.

```bash
git clone https://github.com/Daniel-Brai/inksketch.git
cd inksketch
bun install
bun link
```

`bun link` gives you an `inksketch` command you can run from anywhere. You can also skip it and run the CLI with `bun path/to/inksketch/bin/inksketch.ts`.

Then, in the project where your sketches live, link the library so `import { sketch } from 'inksketch'` resolves.

```bash
bun link inksketch
```

If you'd rather not add it to that project, use a `tsconfig.json` with paths instead. See [Keeping sketch sources in your site repo](#putting-drawings-on-a-website).

## Commands

The ones you'll use most. Run them from your project, with `inksketch` on your path after `bun link`.

```bash
# render one sketch to an SVG next to it
inksketch render art/idea.ts

# render every sketch in a folder into another folder
inksketch render art --out public/drawings

# render again whenever a sketch changes
inksketch watch art

# open a live gallery of a folder at http://127.0.0.1:4747
inksketch preview art

# an inline drawing that follows your site's light and dark theme
inksketch render art/home.ts --theme inherit --out src/assets/drawings

# a drawing for an <img>, with fixed colors
inksketch render art/banner.ts --theme light

# a still 1200x630 PNG for social share cards
inksketch render art/banner.ts --theme light --static --png

# play when scrolled into view, or replay on click
inksketch render art/diagram.ts --theme inherit --trigger visible
inksketch render art/diagram.ts --theme inherit --trigger click

# open the terminal studio in the current folder
inksketch
```

Working on inksketch itself:

| Command                       | What it does                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `bun install`                 | Install dependencies.                                       |
| `bun run typecheck`           | Type-check the library, CLI and tests.                      |
| `bun test`                    | Run the unit tests.                                         |
| `bun run format`              | Format everything with Prettier.                            |
| `bun run examples`            | Render every file in `examples/` to `examples/out/`.        |
| `bun run preview`             | Live gallery of `examples/`.                                |
| `PER_TYPE=100 bun run stress` | Render 100 random drawings of each kind and check them all. |

## Your first drawing

Make a file called `idea.ts`.

```ts
import { sketch } from 'inksketch';

const s = sketch({ width: 640, height: 320, background: 'paper', draw: true });

s.person([140, 290], { look: 'outline', height: 150, pose: 'think' });
s.lightbulb([300, 110], 34);
s.arrow([200, 150], [262, 118], { bend: -0.3 });
s.label([460, 160], 'a small idea', { size: 22 });

export default s;
```

Render it.

```bash
inksketch render idea.ts
```

That writes `idea.svg` next to it. Open it in a browser and it draws itself.

A sketch file default-exports a sketch, or a function that returns one. It can also export `options` with render options like `{ theme: 'light' }`.

## The CLI

```text
inksketch                         open the terminal studio
inksketch render <file|dir...>    render sketches to SVG
inksketch watch <file|dir...>     render again whenever a file changes
inksketch preview [dir]           live gallery in the browser
```

| Option          | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `--out <dir>`   | Where files go. Default is next to each sketch.                 |
| `--theme <t>`   | `auto`, `light`, `dark` or `inherit`. Default `auto`.           |
| `--trigger <t>` | When animation starts. `load`, `visible`, `hover` or `click`.   |
| `--static`      | No animation, just the finished drawing.                        |
| `--png`         | Also write a PNG. Needs `sharp` in the project you run it from. |
| `--scale <n>`   | PNG pixel scale. Default 1.                                     |
| `--port <n>`    | Preview port. Default 4747.                                     |

Pointing `render` at a folder renders every `*.sketch.ts` file in it, or every `.ts` file if none use that suffix.

Each render runs in a fresh process, so edits to a sketch and anything it imports always show up.

The terminal studio lists your sketches. Press enter to render one, `a` to render all, `t` to switch theme, `s` for static, `p` to start the preview and `q` to quit.

## Putting drawings on a website

Your site never needs inksketch installed. You render once and commit the files.

I use inksketch on my own website, [danielbrai.dev](https://danielbrai.dev), which is an Astro site. The sketch sources live in an `art/` folder in the repo, and the rendered SVGs and share images are committed next to the pages that use them.

**Plain image.** Render with a fixed theme and use a normal `<img>`. The animation still plays, because it's CSS inside the SVG.

```bash
inksketch render art/banner.ts --theme light --out src/content/blog/my-post
```

**Inline, following your site's theme.** Render with `--theme inherit` and put the SVG markup straight into the page. Lines use the page's text color. Colors you set as `{ light, dark }` switch when a parent element has `data-theme="dark"`, or with the visitor's system setting.

```astro
---
import drawing from '@/assets/drawings/home.svg?raw'
---

<figure set:html={drawing} />
```

Set `--ik-theme-paper` on a parent to your page background so filled shapes match it.

**Social share images.** Social sites ignore SVG. Render a still PNG at 1200×630 for `og:image`.

```bash
inksketch render art/banner.ts --theme light --static --png
```

**Playback without scripts.** `load` and `hover` are pure CSS. `visible` and `click` need a little JavaScript, and inksketch puts it inside the SVG itself, so inline drawings play on scroll or click with nothing added to your page. Visitors who prefer reduced motion see the finished drawing.

**Keeping sketch sources in your site repo.** Put them in a folder your build ignores, like `art/`, and add `art/tsconfig.json` so imports resolve and your editor gets types.

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "paths": {
      "inksketch": ["../path/to/inksketch/src/index.ts"],
      "inksketch/*": ["../path/to/inksketch/src/*/index.ts"]
    }
  },
  "include": ["**/*.ts"]
}
```

Point the paths at your clone of inksketch. Also exclude `art` in the site's own `tsconfig.json`.

## Drawing

### Sketch options

```ts
sketch({
  width: 800,
  height: 400,
  style: 'ink',
  seed: 'my-drawing',
  background: 'paper',
  texture: 0.5,
  vignette: false,
  title: 'A person tending a bonsai',
  draw: { maxDurationMs: 5000 },
  boil: false,
  palette: { light: { accent: '#c2410c' } },
});
```

The same seed always gives the same drawing. `title` becomes the drawing's accessible label.

### Styles

| Style       | Feel                                      |
| ----------- | ----------------------------------------- |
| `ink`       | A steady fine liner. The default.         |
| `sketch`    | Loose and quick, with double passes.      |
| `pencil`    | Soft graphite.                            |
| `geometric` | Clean lines with no wobble, for diagrams. |
| `chalk`     | White chalk on a dark board.              |

You can mix styles in one drawing.

```ts
s.withStyle('geometric', () => {
  s.rect([40, 40], [200, 120]);
});
```

### Shapes and lines

Points are `[x, y]` and sizes are `[width, height]`.

```ts
s.line([0, 0], [100, 40]);
s.polyline([
  [0, 0],
  [50, 40],
  [100, 0],
]);
s.curve([
  [0, 0],
  [50, 60],
  [100, 0],
]);
s.polygon([
  [0, 0],
  [80, 10],
  [40, 70],
]);
s.rect([10, 10], [120, 80], { radius: 8 });
s.circle([200, 100], 40);
s.ellipse([200, 100], [60, 30]);
s.arc([200, 100], [40, 40], { fromDeg: 180, toDeg: 360 });
s.blob([300, 100], [50, 30]);
s.arrow([0, 0], [120, 60], { bend: 0.2, head: 'filled' });
s.brace([20, 20], [20, 140]);
s.dot([50, 50]);
s.taper(path, [18, 4], { shade: 'right' });
s.path('M0 0 C40 -60 120 -60 160 0', { at: [100, 200] });
s.trace(svgMarkup, { at: [0, 0], size: [120, 120] });
```

`taper` draws a limb that goes from thick to thin, which is good for trunks, branches and brush strokes. `path` hand-draws any SVG path. `trace` redraws a whole SVG, like an icon or a logo, in the current style.

Every shape takes the same ink options: `color`, `width`, `opacity`, `dashed`, `fill`, `roughness`, `pressure` and `draw`. Set `pressure` above 0 for a line that swells and thins like a brush.

### Fills and shading

```ts
s.rect([0, 0], [100, 60], { fill: 'hatch' });
s.circle([200, 50], 40, { fill: { type: 'stipple', density: 6, from: 'bottom' } });
s.polygon(points, { fill: { type: 'wash', color: '#9cc3e6', opacity: 0.3 } });
s.shade(points, 'crosshatch');
s.contourHatch(edge, { length: 10, gap: 4 });
```

Fills are `none`, `paper`, `solid`, `hatch`, `crosshatch`, `stipple` and `wash`. A wash is translucent color laid slightly off the outline, like watercolor.

### Tone

A tone field says how dark each point should be, from 0 to 1. Stipple and hatching can follow it.

```ts
import { tones } from 'inksketch';

s.toneStipple(area, tones.linear([0, 0], [0, 400]), { density: 10 });
s.toneHatch(area, tones.radial([200, 150], 180), { layers: 4 });
s.toneStipple(area, tones.noise({ scale: 40 }), { density: 8 });
```

`tones.pixels(grid, box)` turns grayscale pixel data into a tone field, so a photo can become a stipple drawing. Fields combine with `tones.multiply`, `tones.max`, `tones.mix` and `tones.contrast`.

### Lettering

```ts
s.text([40, 60], 'hand lettered', { size: 20 });
s.label([200, 100], 'centered on this point');
```

Text is drawn as pen strokes by default, so it wobbles and writes itself on like the rest of the drawing. It works in images and PNGs with no fonts. Set `lettering: 'font'` to use a web font instead. Type theory symbols like `λ ∀ ⊢ ⊸ Γ τ` are included.

### Images

```ts
s.image('disk.png', [300, 320], [220, 220]);
s.image('photo.jpg', [0, 0], [400, 300], { fit: 'cover', opacity: 0.8 });
```

Places a picture in the drawing, for the parts you'd rather not draw. Transparent PNGs keep their transparency.
`fit` is `contain` (the default), `cover` or `stretch`.
When the sketch draws itself, the image fades in at its turn on the timeline. Set `draw: false` to show it from the start.

The CLI reads a relative path from the sketch's folder and embeds the file in the SVG, so the output stands on its own.
PNG, JPEG, GIF, WebP, AVIF and SVG files work. A `data:` or `https://` source is left as it is.
When you call `toSVG()` yourself, the source goes into the SVG unchanged, or pass `images` to turn each source into the `href` you want.
A photo keeps its own colours in dark mode, and embedding adds about a third to its file size, so shrink it first.

### Objects, nature and textures

```ts
s.cylinder([100, 100], { label: 'sqlite', shade: 'hatch' });
s.cube([200, 60], 80);
s.document([300, 40], [80, 100], { title: 'spec' });
s.cloud([500, 80], [160, 70]);
s.server([620, 40], [60, 100]);
s.lightbulb([100, 300], 30);
s.gear([200, 300], 40).spin();
s.tree([400, 380], 220, { leaves: 'blossoms' });
s.roots([400, 380], 100);
s.plant([520, 380], 120);
s.leaf([600, 300], 40);
s.sun([700, 80], 24);
s.waves([0, 350], 800, { rows: 3 });
s.grass([0, 380], [800, 380]);
s.pebbles({ x: 0, y: 0, w: 300, h: 160 });
s.cracks({ x: 0, y: 0, w: 300, h: 160 });
s.logEnd([100, 100], 40);
s.stone([100, 100], 40);
s.scribble([100, 100], 30);
s.graph(nodes, edges);
s.swarm({
  shape: { type: 'ring', center: [400, 200], r: 150 },
  count: 800,
  kind: 'figure',
  motion: 'orbit',
});
```

These are shortcuts built from the primitives above. You can draw any of them yourself from scratch.

## People

```ts
s.person([200, 300], {
  height: 140,
  pose: 'wave',
  look: 'outline',
  body: 'feminine',
  outfit: 'dress',
  hair: 'long',
  prop: 'sign',
  propText: 'hello',
  facing: -1,
});
```

People are traced from a body shape, so the outline looks drawn by hand.

- `look` is `solid`, `outline` or `ghost`. A ghost is grey and blurred.
- `body` is `neutral`, `masculine`, `feminine` or `child`.
- `outfit` is `trousers`, `skirt`, `dress` or `coat`.
- `hair` is `none`, `short`, `long`, `bun` or `ponytail`.
- `prop` is `sign`, `briefcase`, `phone`, `umbrella` or `ball`.
- `rendering: 'mechanical'` gives the cleaner tube style.

There are 35 named poses, like `stand`, `walk`, `run`, `think`, `point`, `sit`, `kneel`, `squat`, `holdSign`, `stop` and `tpose`. A pose can also be your own joint angles.

```ts
const reaching = {
  lean: 10,
  tilt: 18,
  armBack: [-4, 20],
  armFront: [110, 25],
  legBack: [-5, 0],
  legFront: [6, 0],
};
s.person([200, 300], { pose: reaching });
```

Angles are degrees from straight down, positive toward where the figure faces. Each limb is `[upper, bend]`. Joints are held to what a human body can do, so knees and elbows only bend one way and the head can't turn backwards. Use `view: 'front'` for figures seen from the front.

Walking people have a 12 frame walk cycle.

```ts
s.walker([100, 300], { look: 'outline', distance: 500, durationMs: 8000 });
s.walker([300, 300], {
  look: 'solid',
  arms: 'holdSign',
  prop: 'sign',
  route: [
    [300, 300],
    [500, 300],
    [380, 300],
  ],
});
```

`route` walks through waypoints and turns to face each direction. `arms` keeps the legs walking while the arms hold a pose. `stickFigure` draws a simple stick figure with the same poses.

## Animation

Every drawing method returns a shape you can animate and time.

```ts
s.stone([100, 200], 30).bounce({ height: 60 });
s.gear([300, 200], 40).spin({ duration: 4000 });
s.leaf([400, 100], 20).travel(
  [
    [400, 100],
    [420, 180],
    [410, 260],
  ],
  { loop: true },
);
s.cloud([600, 80], [140, 60]).float();
```

Motions are `bounce`, `float`, `pulse`, `spin`, `wiggle`, `sway`, `fadeIn`, `pop`, `slideIn`, `blink` and `travel`. `animate` takes your own keyframes.

```ts
s.circle([100, 100], 20).animate(
  [
    { offset: 0, x: 0, opacity: 0 },
    { offset: 0.5, opacity: 1 },
    { offset: 1, x: 200, opacity: 0 },
  ],
  { duration: 3000, loop: true },
);
```

**Draw-on.** With `draw: true` on the sketch, lines appear as if drawn by a pen. Control timing per shape with `.delay(ms)`, `.at(ms)`, `.duration(ms)`, `.together()` and `.instant()`. Set `draw: { loop: true }` to draw, hold, fade and repeat.

**Frames.** `frames` is frame by frame animation, like stop motion.

```ts
s.frames(
  12,
  (sk, i, t) => {
    sk.circle([100 + t * 200, 100], 10 + i);
  },
  { fps: 12 },
);
```

**More.** `morph(from, to)` blends one shape into another. `boil: true` redraws everything a few times a second so lines shimmer. `.between(fromMs, toMs)` shows a shape only during a time window. `define(key, build)` draws something once and `use(key)` places copies of it cheaply, which keeps files small when a drawing repeats things.

## Color and themes

Named colors follow the theme. They are `ink`, `paper`, `muted` and `accent`.

```ts
s.label([100, 50], 'theme aware', { color: { light: '#1d4ed8', dark: '#93c5fd' } });
s.circle([200, 100], 30, { color: 'accent' });
```

Any color can be a `{ light, dark }` pair. Set a whole palette with the `palette` sketch option.

`toSVG({ theme })` picks how colors are written.

- `light` or `dark` write real color values. Use these for files, images and PNGs.
- `auto` follows the visitor's system setting, and also `data-theme` on a parent when inline.
- `inherit` uses the page's text color, for inline drawings.

## Scenes, timelines and films

`inksketch/document` describes drawings as plain JSON, so other tools can save and load them.

A project has scenes. A scene has elements. An element is a component with props, a position, an optional style, a draw-on window, a visibility window, a motion preset, child elements and keyframe tracks.

```ts
import { buildProject, buildScene } from 'inksketch/document';

const scene = buildScene(project, 0);
const film = buildProject(project);

film.toSVG();
film.toSVG({ time: 2500 });
```

Any prop can be keyframed, including single joints of a pose. Numbers and points blend smoothly, poses blend joint by joint, and text and colors hold until the next key. `toSVG({ time })` renders the exact still at that moment, so you can scrub through time or export every frame as video.

`COMPONENTS` lists every component with its inspector fields. `inksketch/figures` exports poses and joint limits, and `inksketch/document/tracks` exports `sampleTrack`, `blend` and `resolvePose`.

## Performance

inksketch is built to stay fast and keep files small.

- Paths use relative coordinates, one decimal, and smooth curves written compactly.
- Repeated parts are drawn once and referenced. People share traced outlines across sizes and directions.
- Everything that can grow has a limit, like dots, hatch lines, crowd size and frame counts. Films share a size budget across their animated elements.

A typical diagram renders in about 15 ms. A detailed bonsai scene renders in under 100 ms and weighs about 30 KB gzipped.

## Layout

```text
src/            the library
src/figures/    people, poses, objects, nature and textures
src/document/   scenes, components, tracks and films
cli/            the CLI, preview server and terminal studio
bin/            the inksketch command
examples/       sample sketches
test/           unit and stress tests
```

## Contributing

Issues and pull requests are welcome. Run the checks before opening a pull request.

```bash
bun run typecheck
bun test
PER_TYPE=20 bun run stress
```

I like to keep the code easy to read and fast so I follow these rules.

- Performance comes first. I measure before and after and I usually like to keep output small.
- Functions take at most four parameters and pass points as `[x, y]` tuples or an options object.
- No `any`, no `!` and no unexplained `as` casts.
- Missing values are `null`, never an empty string.
- No regular expressions where a small scanner or string method will do.
- Comments are rare and short. If there is one it says why not what.

## License

MIT. See [LICENSE](LICENSE).
