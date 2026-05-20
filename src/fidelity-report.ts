import type { LeafClassification, NativeKind } from './types.js';

export type PageClassificationSummary = {
  pageIndex: number;
  pageName: string;
  classifications: LeafClassification[];
};

export type FidelityReportInput = {
  deck: string;
  pages: PageClassificationSummary[];
};

export type FidelityReport = {
  deck: string;
  pages: number;
  totalElements: number;
  // Per-kind tallies. Kinds not seen on the deck are absent (not zeroed)
  // so the JSON sidecar stays human-skimmable.
  byKind: Partial<Record<NativeKind, number>>;
  editablePercent: number;
  generatedAt: string; // ISO-8601, fixed precision (no millis) for diffability.
};

export function buildFidelityReport(input: FidelityReportInput): FidelityReport {
  const byKind: Partial<Record<NativeKind, number>> = {};
  let total = 0;
  for (const p of input.pages) {
    for (const c of p.classifications) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      total += 1;
    }
  }
  // Plan A: classifier never falls back. Every classified leaf is editable.
  // Plan B will subtract the image-fallback share.
  const editablePercent = total === 0 ? 100 : 100;
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    deck: input.deck,
    pages: input.pages.length,
    totalElements: total,
    byKind,
    editablePercent,
    generatedAt,
  };
}
