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

import { classifyLeaf } from '../src/classifier.ts';

test('text leaf with simple style → TextRun', () => {
  const res = classifyLeaf({
    type: 'text',
    text: 'hello',
    rect: { x: 0, y: 0, w: 100, h: 30 },
    color: '#000000',
    fontSize: 16,
    fontFamily: 'sans-serif',
  });
  assert.equal(res.kind, 'TextRun');
});

test('img leaf → Image', () => {
  const res = classifyLeaf({
    type: 'image',
    rect: { x: 0, y: 0, w: 100, h: 100 },
    src: 'data:image/png;base64,iVBOR...',
  });
  assert.equal(res.kind, 'Image');
});

test('decor with background but no text → Box', () => {
  const res = classifyLeaf({
    type: 'decor',
    rect: { x: 0, y: 0, w: 200, h: 100 },
    background: '#fff',
    borderWidth: 0,
  });
  assert.equal(res.kind, 'Box');
});

test('1px tall decor with no text → Line', () => {
  const res = classifyLeaf({
    type: 'decor',
    rect: { x: 0, y: 0, w: 200, h: 1 },
    background: '#000',
    borderWidth: 0,
  });
  assert.equal(res.kind, 'Line');
});

test('table leaf → Table', () => {
  const res = classifyLeaf({
    type: 'table',
    rect: { x: 0, y: 0, w: 800, h: 400 },
    rows: 3, cols: 4,
    hasRowspan: false, hasColspan: false, hasNestedTable: false,
  });
  assert.equal(res.kind, 'Table');
});

test('small simple SVG → SvgIcon', () => {
  const res = classifyLeaf({
    type: 'svg',
    rect: { x: 0, y: 0, w: 24, h: 24 },
    hasPath: false, hasUse: false, hasPattern: false, hasMask: false,
  });
  assert.equal(res.kind, 'SvgIcon');
});
