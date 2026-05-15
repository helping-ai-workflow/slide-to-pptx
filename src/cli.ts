import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPage } from './extract.js';
import { buildPptx } from './pptx-build.js';

async function main() {
  const [cmd, slideArg, ...rest] = process.argv.slice(2);
  if (!cmd) {
    console.error('usage: slide-to-pptx <spike|extract|build> <slide-dir> [--page <name>]');
    process.exit(1);
  }
  const slideDir = path.resolve(slideArg);

  const pageFlagIdx = rest.indexOf('--page');
  const pageName =
    pageFlagIdx >= 0 ? rest[pageFlagIdx + 1] : 'SystemDiagram';

  switch (cmd) {
    case 'extract': {
      const ir = await extractPage(slideDir, { pageName });
      const outDir = path.resolve('out');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${ir.pageName}.ir.json`);
      await writeFile(outPath, JSON.stringify(ir, null, 2), 'utf8');
      console.log(`IR written: ${outPath}`);
      console.log(`  pageName=${ir.pageName} items=${ir.items.length}`);
      return;
    }
    case 'build':
    case 'spike': {
      const ir = await extractPage(slideDir, { pageName });
      const outDir = path.resolve('out');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(outDir, { recursive: true });
      const irPath = path.join(outDir, `${ir.pageName}.ir.json`);
      await writeFile(irPath, JSON.stringify(ir, null, 2), 'utf8');
      console.log(`IR: ${irPath} (items=${ir.items.length})`);
      const pptxPath = path.join(outDir, `${ir.pageName}.pptx`);
      await buildPptx([ir], pptxPath);
      console.log(`PPTX: ${pptxPath}`);
      return;
    }
    default:
      console.error(`unknown cmd: ${cmd}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
