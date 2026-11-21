import { sketch } from 'inksketch';

const s = sketch({ width: 640, height: 320, background: 'paper', draw: true });

s.person([140, 290], { look: 'outline', height: 150, pose: 'think' });
s.lightbulb([300, 110], 34);
s.arrow([200, 150], [262, 118], { bend: -0.3 });
s.label([460, 160], 'a small idea', { size: 22 });

export default s;
