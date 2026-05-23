import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intersectSlide, overflowsCanvas } from '../src/clip-to-slide.ts';

test('rect entirely inside canvas → unchanged', () => {
  assert.deepEqual(
    intersectSlide({ x: 100, y: 100, w: 500, h: 500 }),
    { x: 100, y: 100, w: 500, h: 500 },
  );
});

test('rect bleeds past right edge → clipped right', () => {
  assert.deepEqual(
    intersectSlide({ x: 1800, y: 100, w: 400, h: 200 }),
    { x: 1800, y: 100, w: 120, h: 200 },
  );
});

test('rect bleeds past bottom edge → clipped bottom', () => {
  assert.deepEqual(
    intersectSlide({ x: 100, y: 900, w: 200, h: 400 }),
    { x: 100, y: 900, w: 200, h: 180 },
  );
});

test('rect with negative x → clipped left', () => {
  assert.deepEqual(
    intersectSlide({ x: -100, y: 100, w: 400, h: 200 }),
    { x: 0, y: 100, w: 300, h: 200 },
  );
});

test('rect with negative y → clipped top', () => {
  assert.deepEqual(
    intersectSlide({ x: 100, y: -50, w: 200, h: 300 }),
    { x: 100, y: 0, w: 200, h: 250 },
  );
});

test('GradientOrb pattern: 1400×1400 centered with -50% transform at -10%/-5%', () => {
  // Mirrors the vercel-labs-2026 corner-bleed orb. left: -10% = -192,
  // top: -5% = -54. With translate(-50%, -50%) on a 1400×1400 box,
  // top-left = (-192 - 700, -54 - 700) = (-892, -754). Full rect
  // (-892, -754, 1400, 1400) reaches into the visible slide only at
  // top-left corner.
  // x1 = max(0,-892) = 0; y1 = max(0,-754) = 0;
  // x2 = min(1920,-892+1400) = 508; y2 = min(1080,-754+1400) = 646.
  assert.deepEqual(
    intersectSlide({ x: -892, y: -754, w: 1400, h: 1400 }),
    { x: 0, y: 0, w: 508, h: 646 },
  );
});

test('rect wholly off-canvas (right) → zero-area at canvas edge', () => {
  const r = intersectSlide({ x: 3000, y: 100, w: 400, h: 400 });
  assert.equal(r.w, 0);
  assert.equal(r.h, 400);
  // x clamps to 1920 (canvas right edge) even though intersection is empty.
  assert.equal(r.x, 1920);
});

test('rect wholly off-canvas (top) → zero-area at canvas edge', () => {
  const r = intersectSlide({ x: 100, y: -800, w: 400, h: 400 });
  assert.equal(r.h, 0);
});

test('rect touches edge exactly → no clip', () => {
  assert.deepEqual(
    intersectSlide({ x: 0, y: 0, w: 1920, h: 1080 }),
    { x: 0, y: 0, w: 1920, h: 1080 },
  );
});

test('rect entirely covers canvas → clipped to canvas', () => {
  assert.deepEqual(
    intersectSlide({ x: -500, y: -500, w: 3000, h: 2000 }),
    { x: 0, y: 0, w: 1920, h: 1080 },
  );
});

test('custom canvas size honoured', () => {
  assert.deepEqual(
    intersectSlide({ x: 100, y: 100, w: 500, h: 500 }, 400, 400),
    { x: 100, y: 100, w: 300, h: 300 },
  );
});

test('overflowsCanvas: rect inside canvas → false', () => {
  assert.equal(overflowsCanvas({ x: 100, y: 100, w: 500, h: 500 }), false);
});

test('overflowsCanvas: rect touching edge exactly → false', () => {
  assert.equal(overflowsCanvas({ x: 0, y: 0, w: 1920, h: 1080 }), false);
});

test('overflowsCanvas: rect within 5px tolerance → false', () => {
  assert.equal(overflowsCanvas({ x: -3, y: 0, w: 100, h: 100 }), false);
  assert.equal(overflowsCanvas({ x: 0, y: 0, w: 1923, h: 1080 }), false);
});

test('overflowsCanvas: rect with negative x past tolerance → true', () => {
  assert.equal(overflowsCanvas({ x: -40, y: 80, w: 787, h: 480 }), true);
});

test('overflowsCanvas: roundRect off slide top → true', () => {
  assert.equal(overflowsCanvas({ x: 1419, y: -200, w: 699, h: 700 }), true);
});

test('overflowsCanvas: rect past right edge → true', () => {
  assert.equal(overflowsCanvas({ x: 1800, y: 100, w: 400, h: 200 }), true);
});

test('overflowsCanvas: rect past bottom edge → true', () => {
  assert.equal(overflowsCanvas({ x: 100, y: 900, w: 200, h: 400 }), true);
});

test('overflowsCanvas: custom tolerance honoured', () => {
  assert.equal(overflowsCanvas({ x: -40, y: 0, w: 100, h: 100 }, 50), false);
  assert.equal(overflowsCanvas({ x: -60, y: 0, w: 100, h: 100 }, 50), true);
});
