import type { IRItem, IRPage } from './types.js';
import type { PageMeasure, Rect } from './extract-pw.js';

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

export function measureToIR(m: PageMeasure): IRPage {
  const items: IRItem[] = [];

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

  // Images
  for (const im of m.images) {
    items.push({
      kind: 'Image',
      x: im.rect.x, y: im.rect.y, w: im.rect.w, h: im.rect.h,
      src: im.src, alt: im.alt,
    });
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
