import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLBuilder } from 'fast-xml-parser';
import { buildCustGeomNode, buildLineNode, buildFillNode, type CustGeomSpec } from '../src/custgeom.ts';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  suppressEmptyNode: true,
});

function render(node: any): string {
  return builder.build([node]);
}

// ─── open path ──────────────────────────────────────────────────────────────

test('custGeom: simple 3-point open path → moveTo + 2 lnTo (no close)', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }],
    rect: { x: 0, y: 0, w: 200, h: 50 },
    closed: false,
  };
  const xml = render(buildCustGeomNode(spec));
  assert.match(xml, /<a:custGeom>/);
  assert.match(xml, /<a:moveTo>/);
  // 2 lnTo for 3 points (the moveTo absorbs the first one).
  const lnToCount = (xml.match(/<a:lnTo>/g) || []).length;
  assert.equal(lnToCount, 2);
  assert.doesNotMatch(xml, /<a:close\/>/);
});

test('custGeom: open path with 256 samples → moveTo + 255 lnTo', () => {
  const points = Array.from({ length: 256 }, (_, i) => ({ x: i, y: Math.sin(i / 256 * Math.PI) * 50 }));
  const spec: CustGeomSpec = {
    points,
    rect: { x: 0, y: -50, w: 255, h: 100 },
    closed: false,
  };
  const xml = render(buildCustGeomNode(spec));
  const lnToCount = (xml.match(/<a:lnTo>/g) || []).length;
  assert.equal(lnToCount, 255);
});

// ─── closed path ────────────────────────────────────────────────────────────

test('custGeom: closed 4-point path → moveTo + 3 lnTo + close', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
    rect: { x: 0, y: 0, w: 100, h: 50 },
    closed: true,
  };
  const xml = render(buildCustGeomNode(spec));
  const lnToCount = (xml.match(/<a:lnTo>/g) || []).length;
  assert.equal(lnToCount, 3);
  assert.match(xml, /<a:close\/>/);
});

// ─── coordinate conversion ──────────────────────────────────────────────────

test('custGeom: points convert to local 0..100000 path-coord space', () => {
  // Slide-canvas px (10..210, 20..120) → local 0..100000 / 0..100000.
  const spec: CustGeomSpec = {
    points: [{ x: 10, y: 20 }, { x: 210, y: 20 }, { x: 110, y: 120 }],
    rect: { x: 10, y: 20, w: 200, h: 100 },
    closed: false,
  };
  const xml = render(buildCustGeomNode(spec));
  // First point at local (0, 0).
  assert.match(xml, /<a:moveTo><a:pt x="0" y="0"\/><\/a:moveTo>/);
  // Second at (100000, 0).
  assert.match(xml, /<a:lnTo><a:pt x="100000" y="0"\/><\/a:lnTo>/);
  // Third at (50000, 100000).
  assert.match(xml, /<a:lnTo><a:pt x="50000" y="100000"\/><\/a:lnTo>/);
});

test('custGeom: zero-width bbox → safe (no NaN, x coords clamp to 0)', () => {
  // A pathological vertical line: bbox.w = 0. The local-x conversion must
  // not divide by zero.
  const spec: CustGeomSpec = {
    points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    rect: { x: 50, y: 0, w: 0, h: 100 },
    closed: false,
  };
  const xml = render(buildCustGeomNode(spec));
  // Both points x=0 in local space.
  assert.match(xml, /x="0" y="0"/);
  assert.match(xml, /x="0" y="100000"/);
  // No NaN, no Infinity.
  assert.doesNotMatch(xml, /NaN|Infinity/);
});

// ─── line node ──────────────────────────────────────────────────────────────

test('line node: stroke + width + dashed + endArrow', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    rect: { x: 0, y: 0, w: 10, h: 10 },
    closed: false,
    stroke: '#FF0000',
    strokeWidth: 2,
    dashed: true,
    endArrow: true,
  };
  const xml = render(buildLineNode(spec));
  assert.match(xml, /<a:ln/);
  // Width in EMU: 2 px → 2 * 9525 = 19050.
  assert.match(xml, /w="19050"/);
  // Color
  assert.match(xml, /<a:srgbClr val="FF0000"\/>/);
  // Dashed
  assert.match(xml, /<a:prstDash val="dash"\/>/);
  // Arrow
  assert.match(xml, /<a:tailEnd type="triangle"\/>/);
});

test('line node: stroke only (no dash, no arrow) → no prstDash, no tailEnd', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    rect: { x: 0, y: 0, w: 10, h: 10 },
    closed: false,
    stroke: '#1A1F2E',
    strokeWidth: 1,
  };
  const xml = render(buildLineNode(spec));
  assert.doesNotMatch(xml, /<a:prstDash/);
  assert.doesNotMatch(xml, /<a:tailEnd/);
});

// ─── fill node ──────────────────────────────────────────────────────────────

test('fill node: solid color', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    rect: { x: 0, y: 0, w: 10, h: 10 },
    closed: true,
    fill: '#ABCDEF',
  };
  const node = buildFillNode(spec);
  assert.ok(node);
  const xml = render(node);
  assert.match(xml, /<a:solidFill><a:srgbClr val="ABCDEF"\/><\/a:solidFill>/);
});

test('fill node: missing fill → null', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    rect: { x: 0, y: 0, w: 10, h: 10 },
    closed: false,
  };
  const node = buildFillNode(spec);
  assert.equal(node, null);
});

test('fill node: empty fill string → null', () => {
  const spec: CustGeomSpec = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    rect: { x: 0, y: 0, w: 10, h: 10 },
    closed: false,
    fill: '',
  };
  const node = buildFillNode(spec);
  assert.equal(node, null);
});
