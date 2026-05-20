import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NativeKind, LeafClassification } from '../src/types.ts';

test('NativeKind enum covers six canonical leaf classes', () => {
  const kinds: NativeKind[] = ['TextRun', 'Image', 'Box', 'Line', 'Table', 'SvgIcon'];
  assert.equal(kinds.length, 6);
});

test('LeafClassification carries kind and optional reasons', () => {
  const c: LeafClassification = { kind: 'TextRun', reasons: [] };
  assert.equal(c.kind, 'TextRun');
  assert.deepEqual(c.reasons, []);
});
