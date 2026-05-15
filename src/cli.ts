import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { extractAllPages, extractPage } from './extract.js';
import { buildPptx } from './pptx-build.js';
import type { IRPage } from './types.js';

function help() {
  console.error(`usage:
  slide-to-pptx spike <slide-dir>             # one page (--page Name, default SystemDiagram)
  slide-to-pptx extract <slide-dir> [--all]   # IR JSON only
  slide-to-pptx build <slide-dir> [--all]     # IR + pptx`);
}

async function main() {
  const args = process.argv.slice(2);
  const [cmd, slideArg, ...rest] = args;
  if (!cmd || !slideArg) { help(); process.exit(1); }

  const slideDir = path.resolve(slideArg);
  const all = rest.includes('--all');
  const pageFlagIdx = rest.indexOf('--page');
  const pageName = pageFlagIdx >= 0 ? rest[pageFlagIdx + 1] : 'SystemDiagram';

  const outDir = path.resolve('out');
  await mkdir(outDir, { recursive: true });

  const pages: IRPage[] = all
    ? await extractAllPages(slideDir)
    : [await extractPage(slideDir, { pageName })];

  for (const p of pages) {
    const irPath = path.join(outDir, `${p.pageIndex.toString().padStart(2, '0')}-${p.pageName}.ir.json`);
    await writeFile(irPath, JSON.stringify(p, null, 2), 'utf8');
  }
  console.log(`IR written: ${pages.length} page(s)`);
  printCoverage(pages);

  if (cmd === 'extract') return;

  const pptxName = all
    ? `${path.basename(slideDir)}.pptx`
    : `${pages[0].pageName}.pptx`;
  const pptxPath = path.join(outDir, pptxName);
  await buildPptx(pages, pptxPath, slideDir);
  console.log(`PPTX written: ${pptxPath}`);
}

function printCoverage(pages: IRPage[]) {
  const known = new Set([
    'Box', 'Arrow', 'PageHeading', 'FooterRule', 'FooterLabel', 'PageNum',
    'ProgressTrack', 'AgendaRow', 'ParamRow', 'BitField', 'Gate', 'FSMNode',
    'TextBlock',
  ]);
  for (const p of pages) {
    const counts: Record<string, number> = {};
    for (const it of p.items) {
      counts[it.kind] = (counts[it.kind] ?? 0) + 1;
    }
    const unsupported = p.items.filter((it) => it.kind === 'Unsupported') as any[];
    const summary = Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    const mark = unsupported.length ? '!' : ' ';
    console.log(`  ${mark} ${p.pageIndex.toString().padStart(2)} ${p.pageName.padEnd(22)} ${summary}`);
    for (const u of unsupported) {
      console.log(`        ↳ unsupported: ${u.name}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
