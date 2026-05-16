import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { renderSlideHtml } from './render-html.js';
import { measureSlide } from './extract-pw.js';
import { measureToIR } from './measure-to-ir.js';
import { buildPptx } from './pptx-build.js';
import { postprocessPptx } from './pptx-postprocess.js';
import type { IRPage } from './types.js';

function help() {
  console.error(`usage:
  slide-to-pptx <slide-dir> [options]

  Writes <slide-dir-basename>.pptx into <slide-dir> itself by default.

options:
  --page <name>     only build the page whose function name matches <name>
  --out <dir>       output directory (default: the slide dir)
  --ir              also write IR JSON sidecars next to the pptx
  --ir-only         write IR JSON only, skip pptx
  --html            dump per-page HTML for debugging, skip pptx
  -q, --quiet       suppress progress output (errors still go to stderr)
  -h, --help        show this help`);
}

type Opts = {
  slideDir: string;
  outDir: string;
  pageFilter: string | null;
  emitIR: boolean;
  irOnly: boolean;
  htmlOnly: boolean;
  quiet: boolean;
};

function parseArgs(argv: string[]): Opts | null {
  let slideArg: string | null = null;
  let outArg: string | null = null;
  let pageFilter: string | null = null;
  let emitIR = false;
  let irOnly = false;
  let htmlOnly = false;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') return null;
    if (a === '--page') { pageFilter = argv[++i]; continue; }
    if (a === '--out')  { outArg     = argv[++i]; continue; }
    if (a === '--ir')        { emitIR = true; continue; }
    if (a === '--ir-only')   { irOnly = true; continue; }
    if (a === '--html')      { htmlOnly = true; continue; }
    if (a === '-q' || a === '--quiet') { quiet = true; continue; }
    if (a.startsWith('-')) {
      console.error(`unknown option: ${a}`);
      return null;
    }
    if (slideArg === null) { slideArg = a; continue; }
    console.error(`unexpected positional arg: ${a}`);
    return null;
  }

  if (!slideArg) return null;

  const slideDir = path.resolve(slideArg);
  return {
    slideDir,
    outDir: outArg ? path.resolve(outArg) : slideDir,
    pageFilter,
    emitIR,
    irOnly,
    htmlOnly,
    quiet,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) { help(); process.exit(1); }

  const info = opts.quiet ? () => {} : (msg: string) => console.log(msg);

  await mkdir(opts.outDir, { recursive: true });

  if (opts.htmlOnly) {
    const allHtml = await renderSlideHtml(opts.slideDir);
    for (const p of allHtml) {
      const hp = path.join(opts.outDir, `${p.pageIndex.toString().padStart(2, '0')}-${p.pageName}.html`);
      await writeFile(hp, p.html, 'utf8');
    }
    info(`HTML written: ${allHtml.length} page(s) → ${opts.outDir}`);
    return;
  }

  const allHtml = await renderSlideHtml(opts.slideDir);
  const selected = opts.pageFilter
    ? allHtml.filter((p) => p.pageName === opts.pageFilter)
    : allHtml;
  if (selected.length === 0) {
    console.error(`no page matched filter "${opts.pageFilter}"`);
    process.exit(1);
  }

  const measures = await measureSlide(selected);
  const pages: IRPage[] = measures.map(measureToIR);

  if (opts.emitIR || opts.irOnly) {
    for (const p of pages) {
      const irPath = path.join(opts.outDir, `${p.pageIndex.toString().padStart(2, '0')}-${p.pageName}.ir.json`);
      await writeFile(irPath, JSON.stringify(p, null, 2), 'utf8');
    }
    info(`IR written: ${pages.length} page(s) → ${opts.outDir}`);
  }
  if (!opts.quiet) printCoverage(pages);

  if (opts.irOnly) return;

  const pptxName = opts.pageFilter
    ? `${pages[0].pageName}.pptx`
    : `${path.basename(opts.slideDir)}.pptx`;
  const pptxPath = path.join(opts.outDir, pptxName);
  await buildPptx(pages, pptxPath, opts.slideDir);
  await postprocessPptx(pptxPath);
  info(`PPTX written: ${pptxPath}`);
}

function printCoverage(pages: IRPage[]) {
  for (const p of pages) {
    const counts: Record<string, number> = {};
    const walk = (items: IRPage['items']) => {
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
