#!/usr/bin/env node
// Pre-release visual regression: convert each corpus deck, COM-render
// every pptx page to PNG, pixel-diff vs HTML snapshot, fail if any page
// exceeds the per-deck threshold.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.join(REPO_ROOT, 'bin', 'slide-to-pptx.cjs');
const VBS = path.join(__dirname, 'visual-regression-render.vbs');

const DEFAULT_THRESHOLD = 0.05;

function loadThresholdConfig() {
  const configPath = path.join(REPO_ROOT, 'docs', 'visual-regression-thresholds.json');
  if (!existsSync(configPath)) {
    return { default: DEFAULT_THRESHOLD, overrides: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    return {
      default: typeof parsed.default === 'number' ? parsed.default : DEFAULT_THRESHOLD,
      overrides: parsed.overrides && typeof parsed.overrides === 'object' && !Array.isArray(parsed.overrides) ? parsed.overrides : {},
    };
  } catch (e) {
    console.error(`! failed to parse ${configPath}: ${e.message}`);
    return { default: DEFAULT_THRESHOLD, overrides: {} };
  }
}

function thresholdFor(deckName, slideIdx, config) {
  const o = config.overrides?.[deckName]?.[String(slideIdx)];
  return typeof o?.max === 'number' ? o.max : config.default;
}

function overrideFor(deckName, slideIdx, config) {
  return config.overrides?.[deckName]?.[String(slideIdx)] ?? null;
}

const CORPUS = [
  { name: 'mac-merge-tx-spec',       path: '/home/user/hp_workspace/my-slide/slides/mac-merge-tx-spec' },
  { name: 'how-i-use-claude-code',   path: '/home/user/hp_workspace/my-slide/slides/how-i-use-claude-code' },
  { name: 'getting-started',         path: '/home/user/hp_workspace/my-slide/slides/getting-started' },
  { name: 'aibf-test-en',            path: '/home/user/hp_workspace/my-slide/slides/aibf-test-en' },
  { name: 'filter-stress',           path: path.join(REPO_ROOT, 'tests/fixtures/stress/filter-stress') },
  { name: 'svg-viewbox-stress',      path: path.join(REPO_ROOT, 'tests/fixtures/stress/svg-viewbox-stress') },
  { name: 'object-fit-stress',       path: path.join(REPO_ROOT, 'tests/fixtures/stress/object-fit-stress') },
  { name: 'path-commands-stress',    path: path.join(REPO_ROOT, 'tests/fixtures/stress/path-commands-stress') },
];

const WIN_STAGING_LINUX = '/mnt/c/Users/Joe96/Downloads/pptx-render/vr';

function toWinPath(linuxPath) {
  if (linuxPath.startsWith('/mnt/c/')) {
    return 'C:\\' + linuxPath.slice('/mnt/c/'.length).replace(/\//g, '\\');
  }
  throw new Error(`toWinPath: not a /mnt/c path: ${linuxPath}`);
}

function detectPowerPoint() {
  return existsSync('/mnt/c/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE');
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 180_000, ...opts });
  if (res.status !== 0) {
    console.error(`x ${cmd} ${args.join(' ')}`);
    if (res.stdout) console.error(res.stdout);
    if (res.stderr) console.error(res.stderr);
    throw new Error(`Exit ${res.status}`);
  }
  return res;
}

function readPng(p) {
  return PNG.sync.read(readFileSync(p));
}

function diffPair(aPath, bPath, diffOutPath) {
  const a = readPng(aPath);
  const b = readPng(bPath);
  if (a.width !== b.width || a.height !== b.height) {
    return { ratio: 1, reason: `size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPx = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  if (diffOutPath) writeFileSync(diffOutPath, PNG.sync.write(diff));
  const ratio = diffPx / (a.width * a.height);
  return { ratio, diffPx, total: a.width * a.height };
}

function snapshotFor(deckDir, deckName, slideIdx) {
  const snapDir = path.join(deckDir, `${deckName}.snapshots`);
  const want = String(slideIdx - 1).padStart(2, '0');
  const candidates = readdirSync(snapDir).filter((f) => f.startsWith(`${want}-`));
  if (candidates.length !== 1) {
    throw new Error(`expected 1 snapshot matching ${want}-* in ${snapDir}, got ${candidates.length}`);
  }
  return path.join(snapDir, candidates[0]);
}

async function main() {
  if (!detectPowerPoint()) {
    console.error('No PowerPoint detected. This harness runs only on WSL with PowerPoint installed.');
    process.exit(2);
  }
  if (!existsSync(WIN_STAGING_LINUX)) mkdirSync(WIN_STAGING_LINUX, { recursive: true });

  // Copy VBS to staging dir so cscript.exe can reach it via Windows path
  const vbsStaged = path.join(WIN_STAGING_LINUX, 'visual-regression-render.vbs');
  writeFileSync(vbsStaged, readFileSync(VBS));

  const thresholdConfig = loadThresholdConfig();
  const report = {
    generatedAt: new Date().toISOString(),
    threshold: thresholdConfig.default,
    overrides: thresholdConfig.overrides,
    decks: [],
  };
  let anyFail = false;

  for (const deck of CORPUS) {
    if (!existsSync(deck.path)) {
      console.warn(`! skip ${deck.name}: source not found at ${deck.path}`);
      continue;
    }
    process.stderr.write(`\n=== ${deck.name} ===\n`);

    run('node', [CLI_BIN, deck.path, '--quiet']);

    const baseName = path.basename(deck.path);
    const pptxSrc = path.join(deck.path, `${baseName}.pptx`);
    const stageDir = path.join(WIN_STAGING_LINUX, deck.name);
    if (!existsSync(stageDir)) mkdirSync(stageDir, { recursive: true });
    const pptxStaged = path.join(stageDir, `${baseName}.pptx`);
    writeFileSync(pptxStaged, readFileSync(pptxSrc));

    const outDirLinux = path.join(stageDir, 'out');
    if (!existsSync(outDirLinux)) mkdirSync(outDirLinux, { recursive: true });
    run('cscript.exe', [
      '//nologo',
      toWinPath(vbsStaged),
      toWinPath(pptxStaged),
      toWinPath(outDirLinux),
    ]);

    const pptxPngs = readdirSync(outDirLinux).filter((f) => /^\d{2}\.png$/.test(f)).sort();
    const pageResults = [];
    for (const pngName of pptxPngs) {
      const slideIdx = parseInt(pngName.slice(0, 2), 10);
      const pptxPng = path.join(outDirLinux, pngName);
      let snapshotPng;
      try {
        snapshotPng = snapshotFor(deck.path, baseName, slideIdx);
      } catch (e) {
        pageResults.push({ slideIdx, error: e.message });
        anyFail = true;
        continue;
      }
      const diffOut = path.join(outDirLinux, `diff-${pngName}`);
      const r = diffPair(pptxPng, snapshotPng, diffOut);
      const threshold = thresholdFor(deck.name, slideIdx, thresholdConfig);
      const override = overrideFor(deck.name, slideIdx, thresholdConfig);
      const ok = r.ratio <= threshold;
      const overridePassed = ok && override !== null && r.ratio > thresholdConfig.default;
      const overrideNote = overridePassed
        ? ` (override: ${(threshold * 100).toFixed(0)}% ${override.category ?? 'unknown'})`
        : '';
      const tag = ok ? '  ok' : 'x FAIL';
      console.error(`${tag} slide ${slideIdx} diff=${(r.ratio * 100).toFixed(2)}% (${r.diffPx ?? '-'}/${r.total ?? '-'})${overrideNote}${r.reason ? ' ' + r.reason : ''}`);
      pageResults.push({
        slideIdx,
        ratio: r.ratio,
        ok,
        threshold,
        ...(override ? { override: { max: override.max, category: override.category, reason: override.reason } } : {}),
        reason: r.reason,
      });
      if (!ok) anyFail = true;
    }
    report.decks.push({ name: deck.name, pages: pageResults });
  }

  const reportPath = path.join(REPO_ROOT, 'docs', 'visual-regression-baseline.json');
  if (!existsSync(path.dirname(reportPath))) mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(`\nReport written: ${reportPath}`);
  console.error(`Default threshold: ${thresholdConfig.default * 100}% pixel-diff`);
  const overrideCount = Object.values(thresholdConfig.overrides).reduce((n, pages) => n + Object.keys(pages).length, 0);
  if (overrideCount > 0) {
    console.error(`Per-page overrides loaded: ${overrideCount} pages`);
  }
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
