import { chromium, type Browser } from 'playwright';
import type { PageHtml } from './render-html.js';
import type { PrimRecord } from './instrument.js';

export type Rect = { x: number; y: number; w: number; h: number };

export type PrimMeasure = {
  id: string;
  name: string;
  rect: Rect;
  svgOffset: { x: number; y: number } | null;
  props: Record<string, any>;
  parentId: string | null;    // NEW — closest enclosing primitive id
};

export type TextLeaf = {
  rect: Rect;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  background: string;
  borderColor: string;
  borderRadius: number;
  textAlign: string;
  padding: { t: number; r: number; b: number; l: number };
  groupId: string | null;     // NEW
};

export type ImageLeaf = {
  rect: Rect;
  src: string;
  alt?: string;
  groupId: string | null;     // NEW
};

export type DecorBox = {
  rect: Rect;
  background?: string;
  borderColor?: string;
  borderWidth: number;
  borderRadius: number;
  groupId: string | null;     // NEW
};

export type PageMeasure = {
  pageIndex: number;
  pageName: string;
  primitives: PrimMeasure[];
  texts: TextLeaf[];
  images: ImageLeaf[];
  decors: DecorBox[];
};

const EXTRACT_SCRIPT = `(() => {
  const pickRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  const PRIM_ELEMENTS = Array.from(document.querySelectorAll('[data-prim-id]'));
  const primitives = PRIM_ELEMENTS.map((el) => {
    const svg = el.closest('svg');
    const svgRect = svg ? svg.getBoundingClientRect() : null;
    return {
      id: el.getAttribute('data-prim-id'),
      name: el.getAttribute('data-prim-name'),
      rect: pickRect(el),
      svgOffset: svgRect ? { x: svgRect.left, y: svgRect.top } : null,
      parentId: el.parentElement?.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
    };
  });

  // Set of nodes that are inside a primitive — skip those for generic
  // text/image collection so we don't double-count Box internals etc.
  const inPrim = new WeakSet();
  for (const p of PRIM_ELEMENTS) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_ELEMENT);
    let n; while ((n = walker.nextNode())) inPrim.add(n);
  }

  const images = [];
  for (const img of document.querySelectorAll('img')) {
    if (inPrim.has(img)) continue;
    // Use the positioned wrapper as the rect so an image with objectFit:contain
    // shrinking inside a 540x700 panel still fills the panel in pptx.
    const wrapper = img.parentElement;
    const rect = wrapper ? pickRect(wrapper) : pickRect(img);
    images.push({
      rect,
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
      groupId: img.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
    });
  }

  const trim = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const parseColor = (s) => {
    const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/.exec(s || '');
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  };
  const bgColor = parseColor(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const blendOver = (c) => ({
    r: Math.round(bgColor.r + (c.r - bgColor.r) * c.a),
    g: Math.round(bgColor.g + (c.g - bgColor.g) * c.a),
    b: Math.round(bgColor.b + (c.b - bgColor.b) * c.a),
  });
  const toHex = (c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const colorRgbToHex = (s) => {
    const c = parseColor(s);
    if (!c) return '';
    return toHex(c.a < 1 ? blendOver(c) : c);
  };
  const parsePx = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  const INLINE_TAGS = new Set(['SPAN','EM','STRONG','B','I','A','CODE','SUP','SUB','MARK','U','SMALL','KBD','SAMP','VAR','BR','WBR','NOBR']);
  const isInlineEl = (n) => n.nodeType === 1 && INLINE_TAGS.has(n.tagName);

  const texts = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'STYLE') continue;
    if (INLINE_TAGS.has(el.tagName)) continue; // inline children are folded into parent

    // Children-by-type check
    let hasOwnText = false;
    let hasBlockChild = false;
    for (const c of el.childNodes) {
      if (c.nodeType === 3) {
        if (c.textContent && c.textContent.trim()) hasOwnText = true;
      } else if (c.nodeType === 1) {
        if (!isInlineEl(c)) hasBlockChild = true;
        else if (c.textContent && c.textContent.trim()) hasOwnText = true;
      }
    }
    // Only emit when element is a leaf-of-block: contains text (own or inline)
    // and no block-level children.
    if (!hasOwnText || hasBlockChild) continue;

    const cs = getComputedStyle(el);
    const rect = pickRect(el);
    if (rect.w <= 0 || rect.h <= 0) continue;
    // Pad measured rect slightly: chromium gives content-fit bounds, but
    // PowerPoint's font fallback (Cascadia for JetBrains Mono) renders ~5%
    // wider; without padding short single-line text wraps to two lines.
    rect.w += 8;
    rect.h += 4;
    texts.push({
      rect,
      text: trim(el.textContent),
      fontSize: parsePx(cs.fontSize),
      fontFamily: cs.fontFamily,
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      color: colorRgbToHex(cs.color),
      background: cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? colorRgbToHex(cs.backgroundColor) : '',
      borderColor: cs.borderTopWidth !== '0px' ? colorRgbToHex(cs.borderTopColor) : '',
      borderRadius: parsePx(cs.borderTopLeftRadius),
      textAlign: cs.textAlign,
      padding: {
        t: parsePx(cs.paddingTop),
        r: parsePx(cs.paddingRight),
        b: parsePx(cs.paddingBottom),
        l: parsePx(cs.paddingLeft),
      },
      groupId: el.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
    });
  }

  // Decor boxes: elements with background/border that DO NOT have direct text.
  // Captures card chrome (the wrapper <div> around card content).
  const decors = [];
  for (const el of all) {
    if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'STYLE') continue;
    if (INLINE_TAGS.has(el.tagName)) continue;

    // skip if this element is itself emitted as a text leaf (has own text)
    let hasOwnText = false;
    let hasBlockChild = false;
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.textContent && c.textContent.trim()) hasOwnText = true;
      else if (c.nodeType === 1) {
        if (!isInlineEl(c)) hasBlockChild = true;
        else if (c.textContent && c.textContent.trim()) hasOwnText = true;
      }
    }
    if (hasOwnText && !hasBlockChild) continue;

    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? colorRgbToHex(cs.backgroundColor) : '';
    const hasBorder = cs.borderTopWidth !== '0px';
    const bw = parsePx(cs.borderTopWidth);
    if (!bg && !hasBorder) continue;

    const rect = pickRect(el);
    if (rect.w <= 0 || rect.h <= 0) continue;
    decors.push({
      rect,
      background: bg || '',
      borderColor: hasBorder ? colorRgbToHex(cs.borderTopColor) : '',
      borderWidth: bw,
      borderRadius: parsePx(cs.borderTopLeftRadius),
      groupId: el.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
    });
  }

  return { primitives, texts, images, decors };
})()`;

export async function measureSlide(pages: PageHtml[]): Promise<PageMeasure[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const out: PageMeasure[] = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    for (const p of pages) {
      const propsById = new Map<string, PrimRecord>();
      for (const r of p.primitives) propsById.set(r.id, r);
      await page.setContent(p.html, { waitUntil: 'load' });
      // give web fonts a beat to settle (we set deterministic fonts via the
      // design tokens, but Chromium occasionally measures pre-swap)
      await page.evaluate(() => (document as any).fonts?.ready);
      const raw = await page.evaluate(EXTRACT_SCRIPT);
      const r = raw as { primitives: any[]; texts: TextLeaf[]; images: ImageLeaf[]; decors: DecorBox[] };
      const primitives = r.primitives.map((entry: any) => {
        const rec = propsById.get(entry.id);
        return {
          id: entry.id,
          name: entry.name,
          rect: entry.rect,
          svgOffset: entry.svgOffset,
          props: rec?.props ?? {},
          parentId: entry.parentId,
        } as PrimMeasure;
      });
      out.push({ pageIndex: p.pageIndex, pageName: p.pageName, primitives, texts: r.texts, images: r.images, decors: r.decors });
    }
  } finally {
    await browser.close();
  }
  return out;
}
