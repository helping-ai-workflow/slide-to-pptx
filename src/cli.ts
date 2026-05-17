import './env.js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSlideHtml } from './render-html.js';
import { measureSlide } from './extract-pw.js';
import { measureToIR } from './measure-to-ir.js';
import { buildPptx } from './pptx-build.js';
import { postprocessPptx } from './pptx-postprocess.js';
import type { IRPage } from './types.js';

async function readPackageVersion(): Promise<string> {
  // package.json sits one directory above the built/transpiled cli.js
  // (src/cli.ts → dist/cli.js → ../package.json). Resolve relative to
  // this module so the lookup works regardless of cwd.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '..', 'package.json'),
    path.resolve(here, '..', '..', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf8');
      const v = JSON.parse(raw)?.version;
      if (typeof v === 'string') return v;
    } catch {}
  }
  return 'unknown';
}

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
  -v, --version     print version and exit
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

  const takeValue = (flag: string, i: number): string | null => {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('-')) {
      console.error(`option ${flag} requires a value`);
      return null;
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') return null;
    if (a === '--page') {
      const v = takeValue('--page', i); if (v === null) return null;
      pageFilter = v; i++; continue;
    }
    if (a === '--out') {
      const v = takeValue('--out', i); if (v === null) return null;
      outArg = v; i++; continue;
    }
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

// Page / file basenames flow into path.join — strip anything that would
// either escape the output directory (path separators, leading dots) or
// produce a name the host filesystem refuses to write. Whitelist word
// chars, dots, and hyphens; collapse runs of replacements.
function safeName(s: string): string {
  return s.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '_').slice(0, 120) || '_';
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('-v') || argv.includes('--version')) {
    console.log(await readPackageVersion());
    return;
  }
  if (argv.includes('-h') || argv.includes('--help')) {
    help();
    return;
  }
  const opts = parseArgs(argv);
  if (!opts) { help(); process.exit(1); }

  const info = opts.quiet ? () => {} : (msg: string) => console.log(msg);

  await mkdir(opts.outDir, { recursive: true });

  if (opts.htmlOnly) {
    const { pages: allHtml } = await renderSlideHtml(opts.slideDir);
    for (const p of allHtml) {
      const hp = path.join(opts.outDir, `${p.pageIndex.toString().padStart(2, '0')}-${safeName(p.pageName)}.html`);
      await writeFile(hp, p.html, 'utf8');
    }
    info(`HTML written: ${allHtml.length} page(s) → ${opts.outDir}`);
    return;
  }

  const { pages: allHtml, design } = await renderSlideHtml(opts.slideDir);
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
      const irPath = path.join(opts.outDir, `${p.pageIndex.toString().padStart(2, '0')}-${safeName(p.pageName)}.ir.json`);
      await writeFile(irPath, JSON.stringify(p, null, 2), 'utf8');
    }
    info(`IR written: ${pages.length} page(s) → ${opts.outDir}`);
  }
  if (!opts.quiet) printCoverage(pages);

  if (opts.irOnly) return;

  const pptxName = opts.pageFilter
    ? `${safeName(pages[0].pageName)}.pptx`
    : `${safeName(path.basename(opts.slideDir))}.pptx`;
  const pptxPath = path.join(opts.outDir, pptxName);
  await buildPptx(pages, pptxPath, opts.slideDir, design);
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
