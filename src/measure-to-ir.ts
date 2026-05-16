import type { IRItem, IRPage, IRItemV2, IRGroup, IRPageV2, IRRichText, IRImageV2, IRDecorBox, Run } from './types.js';
import type { PageMeasure, Rect, TextLeaf, ImageLeaf, DecorBox, PrimMeasure } from './extract-pw.js';

const CANVAS_W = 1920 as const;
const CANVAS_H = 1080 as const;

function r(rect: Rect): { x: number; y: number; w: number; h: number } {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function pickFontFamily(family: string): 'mono' | 'body' | 'display' | undefined {
  if (!family) return undefined;
  const f = family.toLowerCase();
  if (f.includes('mono') || f.includes('consolas') || f.includes('jetbrains') || f.includes('cascadia')) return 'mono';
  return 'body';
}

const CANVAS_AREA = 1920 * 1080;

export function measureToIR(m: PageMeasure): IRPage {
  const items: IRItem[] = [];

  // Decor boxes first (drawn back-most) — filter out the body / grid-bg
  // wrapper that already matches the page background.
  for (const d of m.decors) {
    const area = d.rect.w * d.rect.h;
    if (area > CANVAS_AREA * 0.9) continue; // skip whole-page bg
    items.push({
      kind: 'TextBlock',
      x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h,
      text: '',
      fontSize: 1,
      color: '#000000',
      background: d.background || undefined,
      borderColor: d.borderColor || undefined,
      padding: 0,
    });
  }

  // Images next — large opaque content drawn before chrome primitives like
  // FooterRule so the footer paints on top, matching source DOM stacking.
  for (const im of m.images) {
    items.push({
      kind: 'Image',
      x: im.rect.x, y: im.rect.y, w: im.rect.w, h: im.rect.h,
      src: im.src, alt: im.alt,
    });
  }

  // Primitives → typed IR with browser rect overriding any prop-derived xy/wh.
  for (const p of m.primitives) {
    const rect = r(p.rect);
    const props: any = p.props ?? {};
    const svgOff = p.svgOffset;
    switch (p.name) {
      case 'Box': {
        // <g> bbox can extend beyond the source <rect> when the label text
        // overflows. Trust the declared rect coords + measured svg offset.
        const ox = svgOff?.x ?? 0;
        const oy = svgOff?.y ?? 0;
        items.push({
          kind: 'Box',
          x: ox + (props.x ?? 0), y: oy + (props.y ?? 0),
          w: props.w ?? rect.w, h: props.h ?? rect.h,
          label: props.label, sub: props.sub,
          color: props.color, fill: props.fill,
        });
        break;
      }
      case 'Arrow': {
        const ox = svgOff?.x ?? 0;
        const oy = svgOff?.y ?? 0;
        items.push({
          kind: 'Arrow',
          x1: ox + (props.x1 ?? 0), y1: oy + (props.y1 ?? 0),
          x2: ox + (props.x2 ?? 0), y2: oy + (props.y2 ?? 0),
          color: props.color, label: props.label, dashed: !!props.dashed,
        });
        break;
      }
      case 'FSMNode': {
        const ox = svgOff?.x ?? 0;
        const oy = svgOff?.y ?? 0;
        items.push({
          kind: 'FSMNode',
          x: ox + (props.x ?? 0), y: oy + (props.y ?? 0),
          w: props.w ?? 200,
          label: props.label, color: props.color || '#0891b2',
        });
        break;
      }
      case 'PageHeading':
        items.push({
          kind: 'PageHeading',
          x: rect.x, y: rect.y,
          num: props.num, kicker: props.kicker, title: props.title,
        });
        break;
      case 'FooterRule':
        items.push({ kind: 'FooterRule' });
        break;
      case 'FooterLabel':
        items.push({ kind: 'FooterLabel', text: props.text });
        break;
      case 'PageNum':
        items.push({ kind: 'PageNum', n: props.n, total: props.total });
        items.push({ kind: 'ProgressTrack', n: props.n, total: props.total });
        break;
      case 'ProgressTrack':
        items.push({ kind: 'ProgressTrack', n: props.n, total: props.total });
        break;
      case 'AudienceChips':
        break;
      case 'AgendaRow': {
        const item = props.item ?? {};
        items.push({
          kind: 'AgendaRow',
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
          id: item.id, title: item.title, pages: item.pages, aud: item.aud,
        });
        break;
      }
      case 'ParamRow':
        items.push({
          kind: 'ParamRow',
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
          name: props.name, range: props.range,
          def: props.def, desc: props.desc, color: props.color,
        });
        break;
      case 'BitField':
        items.push({
          kind: 'BitField',
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
          bits: props.bits, label: props.label, color: props.color,
        });
        break;
      case 'Gate':
        items.push({
          kind: 'Gate',
          x: rect.x, y: rect.y, w: rect.w, h: rect.h,
          name: props.name, desc: props.desc, src: props.src,
        });
        break;
      default:
        items.push({ kind: 'Unsupported', name: p.name, x: rect.x, y: rect.y });
    }
  }

  // Inline text leaves
  for (const t of m.texts) {
    if (!t.text || !t.text.trim()) continue;
    if (t.rect.w <= 0 || t.rect.h <= 0) continue;
    items.push({
      kind: 'TextBlock',
      x: t.rect.x, y: t.rect.y,
      w: t.rect.w, h: t.rect.h,
      text: t.text,
      fontSize: t.fontSize || 20,
      color: t.color || '#1a1f2e',
      fontFamily: pickFontFamily(t.fontFamily),
      bold: t.fontWeight >= 600,
      align: (t.textAlign === 'center' || t.textAlign === 'right' || t.textAlign === 'left')
        ? (t.textAlign as any) : 'left',
      background: t.background || undefined,
      borderColor: t.borderColor || undefined,
      padding: 0,
    });
  }

  return {
    pageId: `${m.pageIndex}`,
    pageIndex: m.pageIndex,
    pageName: m.pageName,
    size: { w: CANVAS_W, h: CANVAS_H },
    items,
  };
}

// ============================================================
// V2 — builds a nested IR tree where leaves attach to their
// closest tagged primitive ancestor (groupId / parentId).
// ============================================================

const CANVAS_W2 = 1920 as const;
const CANVAS_H2 = 1080 as const;
const CANVAS_AREA2 = CANVAS_W2 * CANVAS_H2;

function r2(rect: Rect) {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function pickFontFamily2(family: string): 'mono' | 'body' | 'display' | undefined {
  if (!family) return undefined;
  const f = family.toLowerCase();
  if (f.includes('mono') || f.includes('consolas') || f.includes('jetbrains') || f.includes('cascadia')) return 'mono';
  return 'body';
}

function textLeafToRich2(t: TextLeaf, id: string): IRRichText {
  // Placeholder single-run conversion. Task 9 (B-3) replaces this with true per-span runs.
  const run: Run = {
    text: t.text,
    color: t.color || '#1a1f2e',
    bold: t.fontWeight >= 600,
  };
  return {
    kind: 'RichText',
    id,
    rect: r2(t.rect),
    runs: [run],
    fontSize: t.fontSize || 20,
    fontFamily: pickFontFamily2(t.fontFamily),
    align: (t.textAlign === 'center' || t.textAlign === 'right' || t.textAlign === 'left')
      ? (t.textAlign as any) : 'left',
    valign: 'top',
  };
}

export function measureToIRv2(m: PageMeasure): IRPageV2 {
  // Buckets keyed by parent id (null = page root).
  const buckets = new Map<string | null, IRItemV2[]>();
  const groupById = new Map<string, IRGroup>();
  const push = (parentId: string | null, item: IRItemV2) => {
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
      rect: r2(p.rect),
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
    if (d.rect.w * d.rect.h > CANVAS_AREA2 * 0.9) continue;
    const decor: IRDecorBox = {
      kind: 'Decor',
      id: `decor-${decorN++}`,
      rect: r2(d.rect),
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
    const img: IRImageV2 = {
      kind: 'ImageV2',
      id: `img-${imgN++}`,
      rect: r2(im.rect),
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
    const rich = textLeafToRich2(t, `txt-${txtN++}`);
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
    size: { w: CANVAS_W2, h: CANVAS_H2 },
    items: buckets.get(null) ?? [],
  };
}
