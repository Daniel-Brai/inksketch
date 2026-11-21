import { createRequire } from 'node:module';
import { join } from 'node:path';

interface SharpLike {
  (
    input: Buffer,
    options: { density: number },
  ): {
    png(options: { palette: boolean; quality: number; compressionLevel: number }): {
      toFile(path: string): Promise<unknown>;
    };
  };
}

function loadSharp(): SharpLike {
  const require = createRequire(join(process.cwd(), 'package.json'));

  try {
    return require('sharp');
  } catch {
    throw new Error('PNG export needs sharp in the current project (bun add -d sharp)');
  }
}

export async function writePng(svg: string, o: { file: string; scale: number }): Promise<void> {
  const sharp = loadSharp();

  await sharp(Buffer.from(svg), { density: 72 * o.scale })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(o.file);
}
