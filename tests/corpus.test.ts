// tests/corpus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/minimal-deck');
const BIN = path.resolve(import.meta.dirname, '..', 'bin/slide-to-pptx.cjs');

test('CLI on minimal-deck writes pptx + snapshots', () => {
  const result = spawnSync('node', [BIN, FIXTURE, '--quiet'], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(result.status, 0, `CLI exit ${result.status}; stderr=${result.stderr}`);

  const pptx = path.join(FIXTURE, 'minimal-deck.pptx');
  assert.ok(existsSync(pptx), 'pptx output missing');

  const snapshotDir = path.join(FIXTURE, 'minimal-deck.snapshots');
  assert.ok(existsSync(snapshotDir), 'snapshots dir missing');

  const firstSnap = path.join(snapshotDir, '00-Title.png');
  assert.ok(existsSync(firstSnap), `expected ${firstSnap}`);
});
