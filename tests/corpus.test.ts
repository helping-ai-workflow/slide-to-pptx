// tests/corpus.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/minimal-deck');
const BIN = path.resolve(import.meta.dirname, '..', 'bin/slide-to-pptx.cjs');

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
