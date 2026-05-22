import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSlideToPptx } from '../src/index.ts';

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
