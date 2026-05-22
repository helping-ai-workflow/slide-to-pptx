import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, '../dist/index.js');

test('dist/index.js exists and exports renderSlideToPptx (build smoke)', async () => {
  assert.ok(existsSync(distPath), `dist/index.js not built — run npm run build`);
  const mod: any = await import(distPath);
  assert.equal(typeof mod.renderSlideToPptx, 'function', 'renderSlideToPptx missing from built module');
});
