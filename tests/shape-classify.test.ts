import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPoints } from '../src/shape-classify.ts';

// ─── degenerate ──────────────────────────────────────────────────────────────

test('classify: empty point list → polyline passthrough', () => {
  const r = classifyPoints([]);
  assert.equal(r.kind, 'polyline');
  if (r.kind === 'polyline') assert.deepEqual(r.points, []);
});

test('classify: single point → polyline passthrough', () => {
  const pts = [{ x: 5, y: 7 }];
  const r = classifyPoints(pts);
  assert.equal(r.kind, 'polyline');
  if (r.kind === 'polyline') assert.deepEqual(r.points, pts);
});

// ─── line cases ──────────────────────────────────────────────────────────────

test('classify: two points → line', () => {
  const r = classifyPoints([{ x: 10, y: 20 }, { x: 110, y: 20 }]);
  assert.equal(r.kind, 'line');
  if (r.kind === 'line') {
    assert.deepEqual(r.a, { x: 10, y: 20 });
    assert.deepEqual(r.b, { x: 110, y: 20 });
  }
});

test('classify: three colinear points (horizontal) → line from first to last', () => {
  const r = classifyPoints([{ x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 }]);
  assert.equal(r.kind, 'line');
  if (r.kind === 'line') {
    assert.deepEqual(r.a, { x: 0, y: 50 });
    assert.deepEqual(r.b, { x: 100, y: 50 });
  }
});

test('classify: five colinear points (diagonal) → line from first to last', () => {
  const r = classifyPoints([
    { x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 50 }, { x: 75, y: 75 }, { x: 100, y: 100 },
  ]);
  assert.equal(r.kind, 'line');
  if (r.kind === 'line') {
    assert.deepEqual(r.a, { x: 0, y: 0 });
    assert.deepEqual(r.b, { x: 100, y: 100 });
  }
});

test('classify: colinear within sub-pixel noise → still a line', () => {
  const r = classifyPoints([
    { x: 0, y: 50 }, { x: 50, y: 50.3 }, { x: 100, y: 50 },
  ]);
  assert.equal(r.kind, 'line');
});

test('classify: not colinear (clear bend) → polyline', () => {
  const r = classifyPoints([{ x: 0, y: 0 }, { x: 50, y: 80 }, { x: 100, y: 0 }]);
  assert.equal(r.kind, 'polyline');
});

// ─── rect cases ──────────────────────────────────────────────────────────────

test('classify: closed 4-corner axis-aligned rect (M L L L Z form) → rect', () => {
  // points pattern: M (0,0) L (100,0) L (100,80) L (0,80) Z → 5 points, last == first
  const r = classifyPoints([
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 0 },
  ]);
  assert.equal(r.kind, 'rect');
  if (r.kind === 'rect') {
    assert.deepEqual(r, { kind: 'rect', x: 0, y: 0, w: 100, h: 80 });
  }
});

test('classify: closed 4-corner rect with sub-pixel closure noise → rect', () => {
  // last point off by 0.2 px — still treated as closed.
  const r = classifyPoints([
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }, { x: 0.2, y: 0 },
  ]);
  assert.equal(r.kind, 'rect');
});

test('classify: closed 4-corner rect, alternate starting corner → rect (normalized)', () => {
  // Same rect but starting from top-right corner clockwise.
  const r = classifyPoints([
    { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 0 }, { x: 100, y: 0 },
  ]);
  assert.equal(r.kind, 'rect');
  if (r.kind === 'rect') {
    assert.deepEqual(r, { kind: 'rect', x: 0, y: 0, w: 100, h: 80 });
  }
});

test('classify: closed 4-corner rotated quad (not axis-aligned) → polyline', () => {
  const r = classifyPoints([
    { x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }, { x: 50, y: 0 },
  ]);
  assert.equal(r.kind, 'polyline');
});

test('classify: closed 5+ point shape (closed pentagon) → polyline', () => {
  const r = classifyPoints([
    { x: 50, y: 0 }, { x: 100, y: 38 }, { x: 80, y: 100 }, { x: 20, y: 100 }, { x: 0, y: 38 }, { x: 50, y: 0 },
  ]);
  assert.equal(r.kind, 'polyline');
});

test('classify: open 4-point zigzag (not closed) → polyline', () => {
  const r = classifyPoints([{ x: 0, y: 0 }, { x: 30, y: 50 }, { x: 60, y: 0 }, { x: 90, y: 50 }]);
  assert.equal(r.kind, 'polyline');
});

// ─── degenerate rect-shaped paths ────────────────────────────────────────────

test('classify: closed 4-corner where two corners coincide (degenerate rect of zero height) → line', () => {
  // M 0 0 L 100 0 L 100 0 L 0 0 Z — degenerate; collapses to a horizontal line.
  // The first colinear-check on (0,0)→(100,0)→(100,0)→(0,0) succeeds because every
  // intermediate point lies on the (0,0)–(0,0) "segment" (trivially), but the
  // dominant axis is the x-axis. Treating this as a line is more useful than rect.
  const r = classifyPoints([
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ]);
  // Implementation choice: this falls into "all colinear, closed" → 'line' from min-x to max-x.
  assert.equal(r.kind, 'line');
});
