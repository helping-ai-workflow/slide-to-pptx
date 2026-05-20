import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NativeKind, LeafClassification } from '../src/types.ts';

test('NativeKind union covers all seven canonical leaf classes', () => {
  const kinds: NativeKind[] = ['TextRun', 'Image', 'Box', 'Line', 'Table', 'SvgIcon', 'ImageFallback'];
  assert.equal(kinds.length, 7);
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
    hasUnsupportedPath: false, hasUse: false, hasPattern: false, hasMask: false,
  });
  assert.equal(res.kind, 'SvgIcon');
});

import { measureToIR } from '../src/measure-to-ir.ts';
import type { PageMeasure } from '../src/extract-pw.ts';

test('measureToIR attaches classification to every leaf', () => {
  const fakePage = {
    pageIndex: 0,
    pageName: 'Test',
    primitives: [{
      id: 'p0', parentId: null, name: 'Root',
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
    }],
    decors: [{
      groupId: 'p0',
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      background: '#fff',
      borderWidth: 0,
      borderRadii: [0, 0, 0, 0],
    }],
    images: [],
    texts: [{
      groupId: 'p0', text: 'hello',
      rect: { x: 100, y: 100, w: 200, h: 40 },
      color: '#000', fontSize: 20, fontFamily: 'sans-serif',
      fontWeight: 400, textAlign: 'left',
    }],
    svgShapes: [],
  } as unknown as PageMeasure;

  const ir = measureToIR(fakePage);
  function walk(items: typeof ir.items): void {
    for (const it of items) {
      if (it.kind === 'Group') { walk(it.children); continue; }
      assert.ok(it.classification, `${it.kind} leaf must have classification`);
    }
  }
  walk(ir.items);
});

test('text leaf with filter:blur → ImageFallback', () => {
  const res = classifyLeaf({
    type: 'text',
    text: 'glowy',
    rect: { x: 0, y: 0, w: 100, h: 30 },
    color: '#000', fontSize: 16, fontFamily: 'sans-serif',
    cssFeatureFlags: {
      filter: 'blur(4px)', mask: '', clipPath: '',
      mixBlendMode: '', transform: '', animationName: '',
    },
  });
  assert.equal(res.kind, 'ImageFallback');
  assert.ok(res.reasons.some((r) => r.startsWith('filter:')));
});

test('decor with clip-path → ImageFallback', () => {
  const res = classifyLeaf({
    type: 'decor',
    rect: { x: 0, y: 0, w: 200, h: 100 },
    background: '#fff', borderWidth: 0,
    cssFeatureFlags: {
      filter: '', mask: '', clipPath: 'circle(50%)',
      mixBlendMode: '', transform: '', animationName: '',
    },
  });
  assert.equal(res.kind, 'ImageFallback');
  assert.ok(res.reasons.some((r) => r.startsWith('clip-path:')));
});

test('svg with unsupported path command → ImageFallback', () => {
  const res = classifyLeaf({
    type: 'svg',
    rect: { x: 0, y: 0, w: 200, h: 200 },
    hasUnsupportedPath: true, hasUse: false, hasPattern: false, hasMask: false,
  });
  assert.equal(res.kind, 'ImageFallback');
  assert.ok(res.reasons.some((r) => r.startsWith('svg:')));
});

test('svg with only supported path commands → SvgIcon', () => {
  const res = classifyLeaf({
    type: 'svg',
    rect: { x: 0, y: 0, w: 200, h: 200 },
    hasUnsupportedPath: false, hasUse: false, hasPattern: false, hasMask: false,
  });
  assert.equal(res.kind, 'SvgIcon');
  assert.ok(res.reasons.some((r) => r.startsWith('svg:')));
});

test('text leaf with no feature flags still → TextRun', () => {
  const res = classifyLeaf({
    type: 'text',
    text: 'plain', rect: { x: 0, y: 0, w: 100, h: 30 },
    color: '#000', fontSize: 16, fontFamily: 'sans-serif',
    cssFeatureFlags: {
      filter: '', mask: '', clipPath: '',
      mixBlendMode: '', transform: '', animationName: '',
    },
  });
  assert.equal(res.kind, 'TextRun');
});

test('measureToIR threads fallbackImageDataUrl through to IR', () => {
  const fakePage = {
    pageIndex: 0,
    pageName: 'Test',
    primitives: [{
      id: 'p0', parentId: null, name: 'Root',
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      svgOffset: null, props: {},
    }],
    decors: [{
      groupId: 'p0',
      leafId: 'p0:0',
      rect: { x: 0, y: 0, w: 200, h: 100 },
      background: '#fff',
      borderWidth: 0,
      borderRadii: [0, 0, 0, 0],
      boxShadow: null,
      cssFeatureFlags: { filter: 'blur(4px)', mask: '', clipPath: '',
        mixBlendMode: '', transform: '', animationName: '' },
      fallbackImageDataUrl: 'data:image/png;base64,XXXX',
    }],
    images: [], texts: [], svgShapes: [],
  };

  const ir = measureToIR(fakePage as any);
  let found = false;
  function walk(items: typeof ir.items): void {
    for (const it of items) {
      if (it.kind === 'Group') { walk(it.children); continue; }
      if (it.kind === 'Decor' && it.fallbackImageDataUrl === 'data:image/png;base64,XXXX') {
        found = true;
      }
    }
  }
  walk(ir.items);
  assert.ok(found, 'expected Decor leaf to carry fallbackImageDataUrl');
});

test('text with filter:blur(0px) (no-op) stays TextRun', () => {
  const res = classifyLeaf({
    type: 'text',
    text: 'crisp', rect: { x: 0, y: 0, w: 100, h: 30 },
    color: '#000', fontSize: 16, fontFamily: 'sans-serif',
    cssFeatureFlags: {
      filter: 'blur(0px)', mask: '', clipPath: '',
      mixBlendMode: '', transform: '', animationName: '',
    },
  });
  assert.equal(res.kind, 'TextRun');
});

test('text with filter:opacity(1) (no-op) stays TextRun', () => {
  const res = classifyLeaf({
    type: 'text',
    text: 'visible', rect: { x: 0, y: 0, w: 100, h: 30 },
    color: '#000', fontSize: 16, fontFamily: 'sans-serif',
    cssFeatureFlags: {
      filter: 'opacity(1)', mask: '', clipPath: '',
      mixBlendMode: '', transform: '', animationName: '',
    },
  });
  assert.equal(res.kind, 'TextRun');
});
