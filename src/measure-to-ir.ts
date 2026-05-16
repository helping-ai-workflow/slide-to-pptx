import type { IRGroup, IRPage, IRItem, IRRichText, IRImage, IRDecorBox, IRShape, Run } from './types.js';
import type { PageMeasure, Rect, TextLeaf, ImageLeaf, DecorBox, PrimMeasure, SvgShape } from './extract-pw.js';

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

function svgToIR(s: SvgShape, id: string): IRItem[] {
  switch (s.tag) {
    case 'rect':
      return [{
        kind: 'Shape', id,
        shape: (s.rx ?? 0) > 0 ? 'roundRect' : 'rect',
        rect: r(s.rect),
        fill: s.fill || undefined,
        stroke: s.stroke || undefined,
        strokeWidth: s.strokeWidth,
        rectRadius: (s.rx ?? 0) > 0 ? (s.rx as number) : undefined,
      } as IRShape];
    case 'circle':
    case 'ellipse':
      return [{
        kind: 'Shape', id, shape: 'ellipse', rect: r(s.rect),
        fill: s.fill || undefined, stroke: s.stroke || undefined, strokeWidth: s.strokeWidth,
      } as IRShape];
    case 'line':
      return [{
        kind: 'Shape', id, shape: 'line',
        rect: {
          x: Math.min(s.x1, s.x2),
          y: Math.min(s.y1, s.y2),
          w: Math.abs(s.x2 - s.x1),
          h: Math.abs(s.y2 - s.y1),
        },
        stroke: s.stroke || undefined,
        strokeWidth: s.strokeWidth,
        dashed: s.dashed,
        endArrow: !!s.markerEnd,
        flipH: s.x1 > s.x2,
        flipV: s.y1 > s.y2,
      } as IRShape];
    case 'polyline': {
      const nums = s.points.trim().split(/[\s,]+/).map(parseFloat).filter((v) => !isNaN(v));
      const out: IRItem[] = [];
      for (let i = 0; i + 3 < nums.length; i += 2) {
        const x1 = nums[i], y1 = nums[i + 1], x2 = nums[i + 2], y2 = nums[i + 3];
        out.push({
          kind: 'Shape', id: `${id}-seg-${i / 2}`, shape: 'line',
          rect: {
            x: Math.min(x1, x2), y: Math.min(y1, y2),
            w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
          },
          stroke: s.stroke || undefined,
          strokeWidth: s.strokeWidth,
          flipH: x1 > x2, flipV: y1 > y2,
        } as IRShape);
      }
      return out;
    }
    case 'text': {
      // Chromium's <text> bbox is tight; PowerPoint's mono fallback (Cascadia
      // for JetBrains Mono) renders ~10–20% wider. Pad generously and shift
      // anchor so the visual stays centered/right where source intended.
      const padW = Math.max(40, s.fontSize * 2);
      const padH = Math.max(8, s.fontSize * 0.5);
      const isCenter = s.textAnchor === 'middle';
      const isRight = s.textAnchor === 'end';
      const dx = isCenter ? padW / 2 : isRight ? padW : 0;
      return [{
        kind: 'RichText', id,
        rect: {
          x: s.rect.x - dx,
          y: s.rect.y,
          w: s.rect.w + padW,
          h: s.rect.h + padH,
        },
        runs: [{
          text: s.text,
          color: s.fill || '#1a1f2e',
        }],
        fontSize: s.fontSize,
        fontFamily: s.fontFamily.toLowerCase().includes('mono')
          || s.fontFamily.toLowerCase().includes('jetbrains')
          || s.fontFamily.toLowerCase().includes('cascadia')
          || s.fontFamily.toLowerCase().includes('consolas')
          ? 'mono' : 'body',
        align: isCenter ? 'center' : isRight ? 'right' : 'left',
        valign: 'top',
      } as IRRichText];
    }
    default:
      return [];
  }
}

function textLeafToRich(t: TextLeaf, id: string): IRRichText {
  const runs: Run[] = (t.runs && t.runs.length > 0)
    ? t.runs.map((r) => ({
        text: r.text,
        color: r.color || t.color || '#1a1f2e',
        bold: r.bold,
        italic: r.italic,
        mono: r.mono,
      }))
    : [{ text: t.text, color: t.color || '#1a1f2e', bold: t.fontWeight >= 600 }];
  return {
    kind: 'RichText',
    id,
    rect: r(t.rect),
    runs,
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

  // 2) Decor FIRST — pushed before groups so they end up at the BACK of the
  //    z-stack in every bucket. Otherwise an outer card's white panel would
  //    paint on top of the BitField groups it contains and hide them.
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
      borderRadii: d.borderRadii,
      boxShadow: d.boxShadow || undefined,
    };
    push(d.groupId, decor);
  }

  // 3) Place groups under their parent — drawn on top of any decor that
  //    shares the same bucket.
  for (const p of m.primitives) {
    const g = groupById.get(p.id)!;
    push(p.parentId, g);
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

  // 6) SVG primitives — emit one or more IR items, attribute to closest group.
  let svgN = 0;
  for (const s of m.svgShapes) {
    const items = svgToIR(s, `svg-${svgN++}`);
    for (const item of items) {
      push(s.groupId, item);
    }
  }

  // 8) Resolve buckets onto groups + root.
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
