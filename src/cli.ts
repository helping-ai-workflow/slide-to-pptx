import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { renderSlideHtml } from './render-html.js';
import { measureSlide } from './extract-pw.js';
import { measureToIRv2 } from './measure-to-ir.js';
import { buildPptxV2 } from './pptx-build.js';
import { postprocessPptx } from './pptx-postprocess.js';
import type { IRPageV2 } from './types.js';

function help() {
  console.error(`usage:
  slide-to-pptx build <slide-dir> [--page <name>]   # IR + pptx for one page or all
  slide-to-pptx extract <slide-dir> [--page <name>] # IR JSON only
  slide-to-pptx html <slide-dir>                    # dump per-page HTML for debug`);
}

async function main() {
  const [cmd, slideArg, ...rest] = process.argv.slice(2);
  if (!cmd || !slideArg) { help(); process.exit(1); }

  const slideDir = path.resolve(slideArg);
  const pageFlagIdx = rest.indexOf('--page');
  const pageFilter = pageFlagIdx >= 0 ? rest[pageFlagIdx + 1] : null;

  const outDir = path.resolve('out');
  await mkdir(outDir, { recursive: true });

  if (cmd === 'html') {
    const allHtml = await renderSlideHtml(slideDir);
    for (const p of allHtml) {
      const hp = path.join(outDir, `${p.pageIndex.toString().padStart(2, '0')}-${p.pageName}.html`);
      await writeFile(hp, p.html, 'utf8');
    }
    console.log(`HTML written: ${allHtml.length} page(s) → ${outDir}`);
    return;
  }

  if (cmd !== 'build' && cmd !== 'extract') {
    help(); process.exit(1);
  }

  const allHtml = await renderSlideHtml(slideDir);
  const selected = pageFilter
    ? allHtml.filter((p) => p.pageName === pageFilter)
    : allHtml;
  if (selected.length === 0) {
    console.error(`no page matched filter "${pageFilter}"`);
    process.exit(1);
  }

  const measures = await measureSlide(selected);
  const pages: IRPageV2[] = measures.map(measureToIRv2);

  for (const p of pages) {
    const irPath = path.join(outDir, `${p.pageIndex.toString().padStart(2, '0')}-${p.pageName}.ir.json`);
    await writeFile(irPath, JSON.stringify(p, null, 2), 'utf8');
  }
  console.log(`IR written: ${pages.length} page(s)`);
  printCoverage(pages);

  if (cmd === 'extract') return;

  const pptxName = pageFilter
    ? `${pages[0].pageName}.pptx`
    : `${path.basename(slideDir)}.pptx`;
  const pptxPath = path.join(outDir, pptxName);
  await buildPptxV2(pages, pptxPath, slideDir);
  await postprocessPptx(pptxPath);
  console.log(`PPTX written: ${pptxPath}`);
}

function printCoverage(pages: IRPageV2[]) {
  for (const p of pages) {
    const counts: Record<string, number> = {};
    const walk = (items: IRPageV2['items']) => {
      for (const it of items) {
        counts[it.kind] = (counts[it.kind] ?? 0) + 1;
        if (it.kind === 'Group') walk(it.children);
      }
    };
    walk(p.items);
    const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`    ${p.pageIndex.toString().padStart(2)} ${p.pageName.padEnd(22)} ${summary}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
