import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSlideToPptx, type ProgressEvent } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

test('renderSlideToPptx returns a Buffer whose first 4 bytes are PK\\x03\\x04 (valid ZIP)', async () => {
  const fixture = path.resolve(here, 'fixtures/stress/svg-viewbox-stress');
  const buf = await renderSlideToPptx({ slideDir: fixture });
  assert.ok(Buffer.isBuffer(buf), 'expected Buffer');
  assert.equal(buf[0], 0x50, 'byte 0 != "P"');
  assert.equal(buf[1], 0x4b, 'byte 1 != "K"');
  assert.equal(buf[2], 0x03, 'byte 2 != 0x03');
  assert.equal(buf[3], 0x04, 'byte 3 != 0x04');
  assert.ok(buf.length > 1024, `pptx too small (${buf.length} bytes)`);
});

test('renderSlideToPptx emits per-page rendering progress events', async () => {
  const fixture = path.resolve(here, 'fixtures/stress/svg-viewbox-stress');
  const events: ProgressEvent[] = [];
  await renderSlideToPptx({
    slideDir: fixture,
    onProgress: (e) => events.push(e),
  });

  const rendering = events.filter((e) => e.phase === 'rendering');
  assert.ok(rendering.length >= 1, `expected ≥1 rendering events, got ${rendering.length}`);
  // svg-viewbox-stress has 4 pages — verify the last rendering event reports current=total.
  const last = rendering[rendering.length - 1] as Extract<ProgressEvent, { phase: 'rendering' }>;
  assert.equal(last.current, last.total, 'last rendering event should have current===total');
  assert.ok(last.total >= 1, 'total should be ≥1');

  // Verify the phase ordering: loading → measuring → rendering+ → building → postprocessing → done
  const phases = events.map((e) => e.phase);
  const firstLoading = phases.indexOf('loading');
  const firstMeasuring = phases.indexOf('measuring');
  const firstRendering = phases.indexOf('rendering');
  const firstBuilding = phases.indexOf('building');
  const firstDone = phases.indexOf('done');
  assert.ok(firstLoading >= 0 && firstLoading < firstMeasuring, 'loading must precede measuring');
  assert.ok(firstMeasuring < firstRendering, 'measuring must precede rendering');
  assert.ok(firstRendering < firstBuilding, 'rendering must precede building');
  assert.ok(firstBuilding < firstDone, 'building must precede done');
});
