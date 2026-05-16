import type { IRGroup, IRPage, IRItem, IRRichText, IRImage, IRDecorBox, Run } from './types.js';
import type { PageMeasure, Rect, TextLeaf, ImageLeaf, DecorBox, PrimMeasure } from './extract-pw.js';

const CANVAS_W = 1920 as const;
const CANVAS_H = 1080 as const;
const CANVAS_AREA = CANVAS_W * CANVAS_H;

function r(rect: Rect) {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function pickFontFamily(family: string): 'mono' | 'body' | 'display' | undefined {
  if (!family) return undefined;
  const f = family.toLowerCase();
  if (f.includes('mono') || f.includes('consolas') || f.includes('jetbrains') || f.includes('cascadia')) return 'mono';
  return 'body';
}

function textLeafToRich(t: TextLeaf, id: string): IRRichText {
  // Placeholder single-run conversion. Task 9 (B-3) replaces this with true per-span runs.
  const run: Run = {
    text: t.text,
    color: t.color || '#1a1f2e',
    bold: t.fontWeight >= 600,
  };
  return {
    kind: 'RichText',
    id,
    rect: r(t.rect),
    runs: [run],
    fontSize: t.fontSize || 20,
    fontFamily: pickFontFamily(t.fontFamily),
    align: (t.textAlign === 'center' || t.textAlign === 'right' || t.textAlign === 'left')
      ? (t.textAlign as any) : 'left',
    valign: 'top',
  };
}

export function measureToIR(m: PageMeasure): IRPage {
  // Buckets keyed by parent id (null = page root).
  const buckets = new Map<string | null, IRItem[]>();
  const groupById = new Map<string, IRGroup>();
  const push = (parentId: string | null, item: IRItem) => {
    let arr = buckets.get(parentId);
    if (!arr) { arr = []; buckets.set(parentId, arr); }
    arr.push(item);
  };

  // 1) Create empty groups for every primitive — preserves declaration order.
  for (const p of m.primitives) {
    const g: IRGroup = {
      kind: 'Group',
      id: p.id,
      name: p.name,
      rect: r(p.rect),
      children: [],
    };
    groupById.set(p.id, g);
  }

  // 2) Place groups under their parent (or root).
  for (const p of m.primitives) {
    const g = groupById.get(p.id)!;
    push(p.parentId, g);
  }

  // 3) Decor → either inside its group or at root.
  let decorN = 0;
  for (const d of m.decors) {
    if (d.rect.w * d.rect.h > CANVAS_AREA * 0.9) continue;
    const decor: IRDecorBox = {
      kind: 'Decor',
      id: `decor-${decorN++}`,
      rect: r(d.rect),
      background: d.background || undefined,
      borderColor: d.borderColor || undefined,
      borderWidth: d.borderWidth,
      borderRadii: [d.borderRadius, d.borderRadius, d.borderRadius, d.borderRadius],
    };
    push(d.groupId, decor);
  }

  // 4) Images.
  let imgN = 0;
  for (const im of m.images) {
    const img: IRImage = {
      kind: 'Image',
      id: `img-${imgN++}`,
      rect: r(im.rect),
      src: im.src,
      alt: im.alt,
    };
    push(im.groupId, img);
  }

  // 5) Text leaves.
  let txtN = 0;
  for (const t of m.texts) {
    if (!t.text || !t.text.trim()) continue;
    if (t.rect.w <= 0 || t.rect.h <= 0) continue;
    const rich = textLeafToRich(t, `txt-${txtN++}`);
    push(t.groupId, rich);
  }

  // 6) Resolve buckets onto groups + root.
  for (const [parentId, items] of buckets) {
    if (parentId == null) continue;
    const g = groupById.get(parentId);
    if (g) g.children = items;
  }

  return {
    pageId: `${m.pageIndex}`,
    pageIndex: m.pageIndex,
    pageName: m.pageName,
    size: { w: CANVAS_W, h: CANVAS_H },
    items: buckets.get(null) ?? [],
  };
}
