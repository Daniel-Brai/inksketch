import { expect, test } from 'bun:test';
import {
  buildProject,
  buildScene,
  type ElementDoc,
  type ProjectDoc,
  type SceneDoc,
} from 'inksketch/document';

function element(id: string, extra: Partial<ElementDoc>): ElementDoc {
  return {
    id,
    name: id,
    component: 'text',
    props: { lettering: 'font' },
    x: 100,
    y: 100,
    rotate: 0,
    scale: 1,
    opacity: 1,
    style: null,
    draw: null,
    visible: { fromMs: 0, toMs: null },
    tracks: {},
    propTracks: {},
    motion: null,
    hidden: false,
    locked: false,
    children: [],
    ...extra,
  };
}

function scene(
  id: string,
  options: { text: string; transition: SceneDoc['transition']; elements?: ElementDoc[] },
): SceneDoc {
  return {
    id,
    name: id,
    durationMs: 2000,
    fps: 12,
    background: 'paper',
    texture: 0,
    vignette: 0,
    seed: id,
    style: 'ink',
    transition: options.transition,
    elements: [
      element(`${id}-label`, { props: { lettering: 'font', text: options.text } }),
      ...(options.elements ?? []),
    ],
  };
}

const project: ProjectDoc = {
  version: 1,
  id: 'film',
  title: 'film',
  width: 400,
  height: 200,
  palette: {},
  scenes: [
    scene('one', { text: 'alpha', transition: { kind: 'fade', durationMs: 500 } }),
    scene('two', { text: 'beta', transition: { kind: 'cut', durationMs: 0 } }),
    scene('three', { text: 'gamma', transition: { kind: 'cut', durationMs: 0 } }),
  ],
};

function numbersAfter(text: string, marker: string, unit: string | null): number[] {
  const found: number[] = [];
  let at = text.indexOf(marker);

  while (at !== -1) {
    const start = at + marker.length;
    let end = start;

    while (end < text.length && '-.0123456789'.includes(text.charAt(end))) end++;

    if (unit === null || text.startsWith(unit, end)) found.push(Number(text.slice(start, end)));

    at = text.indexOf(marker, end);
  }

  return found;
}

test('a film still shows only the scene at that time', () => {
  const film = buildProject(project);
  const filmAt = (ms: number): string => film.toSVG({ time: ms, theme: 'light' });

  const early = filmAt(500);
  const middle = filmAt(3200);
  const late = filmAt(5500);

  expect(early).toContain('>alpha<');
  expect(early).not.toContain('>beta<');
  expect(early).not.toContain('>gamma<');

  expect(middle).toContain('>beta<');
  expect(middle).not.toContain('>alpha<');
  expect(middle).not.toContain('>gamma<');

  expect(late).toContain('>gamma<');
  expect(late).not.toContain('>alpha<');
  expect(late).not.toContain('>beta<');
});

test('a fade transition overlaps both scenes and fades the next one in', () => {
  const film = buildProject(project);
  const midFade = film.toSVG({ time: 2250, theme: 'light' });
  const partial = numbersAfter(midFade, 'opacity:', null).filter((o) => o >= 0.3 && o <= 0.8);

  expect(midFade).toContain('>alpha<');
  expect(midFade).toContain('>beta<');
  expect(partial.length).toBeGreaterThan(0);
});

test('eased transform tracks follow their easing in still frames', () => {
  const mover = element('mover', {
    component: 'rect',
    props: { w: 10, h: 10 },
    x: 0,
    tracks: {
      x: [
        { atMs: 0, value: 0, easing: 'ease-in' },
        { atMs: 1000, value: 100 },
      ],
    },
  });

  const soloProject: ProjectDoc = {
    ...project,
    scenes: [
      scene('solo', { text: 'x', transition: { kind: 'cut', durationMs: 0 }, elements: [mover] }),
    ],
  };

  const soloScene = buildScene(soloProject, 0);

  const translateXAt = (ms: number): number =>
    numbersAfter(soloScene.toSVG({ time: ms }), 'translate(', 'px')[0] ?? Number.NaN;

  expect(translateXAt(250)).toBeLessThan(15);
  expect(translateXAt(750)).toBeGreaterThan(40);
  expect(translateXAt(750)).toBeLessThan(75);
  expect(translateXAt(1000)).toBeCloseTo(100, 0);
});
