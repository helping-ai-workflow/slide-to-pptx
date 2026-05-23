// tests/corpus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/minimal-deck');
const BIN = path.resolve(import.meta.dirname, '..', 'bin/slide-to-pptx.cjs');

const CANVAS_OVERFLOW_FIXTURE = path.resolve(
  import.meta.dirname,
  'fixtures/patterns/canvas-overflow-stress',
);

// Slide canvas is 1920×1080 px → EMU @ pptxgenjs's 9525 emu/px.
const SLIDE_W_EMU = 1920 * 9525;
const SLIDE_H_EMU = 1080 * 9525;
// Tolerance for AA / sub-px / integer-rounding noise in pptxgenjs's
// coordinate emission. Anything past this is an honest-to-goodness
// overflow that PowerPoint will render outside the slide.
const OVERFLOW_TOLERANCE_EMU = 5 * 9525;

type ShapeRect = { name: string; x: number; y: number; cx: number; cy: number };

function extractShapeRects(slideXml: string): ShapeRect[] {
  // Walk top-level <p:sp>, <p:pic>, <p:grpSp> blocks linearly and pick
  // the FIRST <a:off>/<a:ext> pair inside each. The first xfrm is the
  // shape/group's own transform; nested children inside a <p:grpSp>
  // have their own xfrms that the linear walker visits as separate
  // entries when their parent block has been consumed. Plain regex on
  // tag names avoids pulling in an XML parser for one-off inspection.
  const rects: ShapeRect[] = [];
  let idx = 0;
  while (true) {
    const candidates = [
      ['p:sp', slideXml.indexOf('<p:sp>', idx)],
      ['p:pic', slideXml.indexOf('<p:pic>', idx)],
      ['p:grpSp', slideXml.indexOf('<p:grpSp>', idx)],
    ].filter((c) => (c[1] as number) >= 0) as Array<[string, number]>;
    if (candidates.length === 0) break;
    candidates.sort((a, b) => a[1] - b[1]);
    const [tag, start] = candidates[0];
    const endMarker = `</${tag}>`;
    const end = slideXml.indexOf(endMarker, start);
    if (end < 0) break;
    const block = slideXml.slice(start, end + endMarker.length);
    idx = end + endMarker.length;
    const nm = /<p:cNvPr\s+id="\d+"\s+name="([^"]+)"/.exec(block);
    const off = /<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"\/?>/.exec(block);
    const ext = /<a:ext\s+cx="(-?\d+)"\s+cy="(-?\d+)"\/?>/.exec(block);
    if (!off || !ext) continue;
    rects.push({
      name: nm ? nm[1] : '?',
      x: Number(off[1]),
      y: Number(off[2]),
      cx: Number(ext[1]),
      cy: Number(ext[2]),
    });
  }
  return rects;
}

test('CLI on minimal-deck writes pptx, snapshots, and fidelity report', async () => {
  const result = spawnSync('node', [BIN, FIXTURE, '--quiet'], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `CLI exit ${result.status}; stderr=${result.stderr}`);

  const pptx = path.join(FIXTURE, 'minimal-deck.pptx');
  assert.ok(existsSync(pptx), 'pptx output missing');

  const snapshotDir = path.join(FIXTURE, 'minimal-deck.snapshots');
  assert.ok(existsSync(snapshotDir), 'snapshots dir missing');
  assert.ok(existsSync(path.join(snapshotDir, '00-Title.png')));
  assert.ok(existsSync(path.join(snapshotDir, '01-FilterPage.png')));

  const reportPath = path.join(FIXTURE, 'minimal-deck.fidelity.json');
  assert.ok(existsSync(reportPath), 'fidelity.json missing');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  assert.equal(report.deck, 'minimal-deck');
  assert.equal(report.pages, 2);
  assert.ok(report.totalElements > 0);
  assert.ok(typeof report.byKind === 'object');
  assert.ok(report.editablePercent < 100, 'expected at least one ImageFallback to drop editable%');
  assert.ok(report.fallbacks.length >= 1, 'expected at least one fallback entry');
  assert.ok(
    report.fallbacks.some((f: any) => f.reasons.some((r: string) => r.startsWith('filter:'))),
    'expected a filter-driven fallback',
  );
});

test('CLI on canvas-overflow-stress: no primimg/shape extends past slide bounds', async () => {
  // Regression for the vercel-labs-2026 GradientOrb pattern: decks wrap
  // their canvas in overflow:hidden and place soft-gradient orbs past
  // the canvas edges. Pre-fix, extract-pw screenshotted each primitive
  // at its full element rect, so the resulting primimg would sit half
  // off-slide in PowerPoint. clip-to-slide.ts + the extract-pw clip
  // wiring intersect every primimg rect with [0,0,1920,1080] and crop
  // the screenshot accordingly. This test runs the CLI on a synthetic
  // fixture that places three orbs deliberately past every canvas edge
  // and asserts the emitted pptx contains no shape whose xfrm overflows
  // the canvas by more than OVERFLOW_TOLERANCE_EMU.
  const result = spawnSync('node', [BIN, CANVAS_OVERFLOW_FIXTURE, '--quiet'], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `CLI exit ${result.status}; stderr=${result.stderr}`);

  const pptxPath = path.join(
    CANVAS_OVERFLOW_FIXTURE,
    'canvas-overflow-stress.pptx',
  );
  assert.ok(existsSync(pptxPath), 'canvas-overflow-stress.pptx missing');

  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);
  const slideEntries = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort();
  assert.ok(slideEntries.length === 3, `expected 3 slides, got ${slideEntries.length}`);

  const overflows: Array<{ slide: string; rect: ShapeRect; worstPx: number }> = [];
  for (const entry of slideEntries) {
    const xml = await zip.files[entry].async('string');
    for (const r of extractShapeRects(xml)) {
      const outL = -r.x;
      const outT = -r.y;
      const outR = r.x + r.cx - SLIDE_W_EMU;
      const outB = r.y + r.cy - SLIDE_H_EMU;
      const worst = Math.max(outL, outT, outR, outB);
      if (worst > OVERFLOW_TOLERANCE_EMU) {
        overflows.push({ slide: entry, rect: r, worstPx: Math.round(worst / 9525) });
      }
    }
  }
  assert.equal(
    overflows.length,
    0,
    `expected no shapes overflowing >5px; found:\n${overflows
      .map((o) => `  ${o.slide} ${o.rect.name} worst=${o.worstPx}px`)
      .join('\n')}`,
  );
});
