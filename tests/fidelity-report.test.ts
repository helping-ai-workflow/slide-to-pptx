import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFidelityReport, type FidelityReport } from '../src/fidelity-report.ts';

test('buildFidelityReport tallies kinds, lists fallbacks, computes editable%', () => {
  const report: FidelityReport = buildFidelityReport({
    deck: 'mixed-deck',
    pages: [{
      pageIndex: 0,
      pageName: 'Page',
      classifications: [
        { leafId: 'p0:0', classification: { kind: 'TextRun', reasons: ['text'] } },
        { leafId: 'p0:1', classification: { kind: 'TextRun', reasons: ['text'] } },
        { leafId: 'p0:2', classification: { kind: 'Box', reasons: ['decor:box'] } },
        { leafId: 'p0:3', classification: { kind: 'ImageFallback', reasons: ['filter:blur(4px)'] } },
      ],
    }],
  });
  assert.equal(report.totalElements, 4);
  assert.deepEqual(report.byKind, { TextRun: 2, Box: 1, ImageFallback: 1 });
  assert.equal(report.editablePercent, 75);
  assert.equal(report.fallbacks.length, 1);
  assert.equal(report.fallbacks[0].leafId, 'p0:3');
  assert.deepEqual(report.fallbacks[0].reasons, ['filter:blur(4px)']);
});
