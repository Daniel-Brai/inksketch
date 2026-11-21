import { sketch } from 'inksketch';

const s = sketch({ width: 1000, height: 360, background: 'paper', seed: 'people' });

s.walker([60, 300], {
  look: 'outline',
  height: 118,
  body: 'feminine',
  outfit: 'dress',
  hair: 'long',
  distance: 860,
  durationMs: 14000,
  opacity: 0.35,
});

s.walker([180, 318], {
  look: 'outline',
  height: 140,
  body: 'masculine',
  distance: 640,
  durationMs: 9000,
});

s.walker([300, 322], {
  look: 'outline',
  height: 136,
  body: 'feminine',
  outfit: 'skirt',
  hair: 'ponytail',
  distance: 560,
  durationMs: 8500,
});

s.walker([860, 312], {
  look: 'outline',
  height: 132,
  body: 'masculine',
  outfit: 'coat',
  hair: 'short',
  facing: -1,
  distance: -620,
  durationMs: 9500,
});

s.walker([940, 296], { look: 'ghost', height: 110, facing: -1, distance: -780, durationMs: 15000 });

s.walker([420, 326], {
  look: 'solid',
  height: 150,
  arms: 'holdSign',
  prop: 'sign',
  propText: 'stop!',
  route: [
    [420, 326],
    [620, 322],
    [480, 330],
    [700, 324],
    [560, 326],
  ],
});

s.person([700, 330], {
  look: 'outline',
  height: 96,
  body: 'child',
  hair: 'bun',
  pose: 'lookUp',
  facing: -1,
});

export default s;
