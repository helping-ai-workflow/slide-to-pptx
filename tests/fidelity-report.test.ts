import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFidelityReport, type FidelityReport } from '../src/fidelity-report.ts';

test('buildFidelityReport sums classification by kind and computes editable%', () => {
  const report: FidelityReport = buildFidelityReport({
    deck: 'minimal-deck',
    pages: [
      {
        pageIndex: 0,
        pageName: 'Title',
        classifications: [
          { kind: 'TextRun', reasons: ['text'] },
          { kind: 'TextRun', reasons: ['text'] },
          { kind: 'Box',     reasons: ['decor:box'] },
        ],
      },
      {
        pageIndex: 1,
        pageName: 'Content',
        classifications: [
          { kind: 'Image', reasons: ['img'] },
          { kind: 'Table', reasons: ['table:3x4'] },
        ],
      },
    ],
  });

  assert.equal(report.deck, 'minimal-deck');
  assert.equal(report.pages, 2);
  assert.equal(report.totalElements, 5);
  assert.deepEqual(report.byKind, { TextRun: 2, Image: 1, Box: 1, Table: 1 });
  assert.equal(report.editablePercent, 100);
});
