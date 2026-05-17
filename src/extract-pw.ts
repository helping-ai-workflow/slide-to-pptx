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
  runs: { text: string; color: string; bold: boolean; italic: boolean; mono: boolean }[];
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
  borderRadii: [number, number, number, number];
  boxShadow: { offsetX: number; offsetY: number; blur: number; color: string } | null;
  groupId: string | null;     // NEW
};

export type SvgShape = {
  tag: string;          // 'rect' | 'line' | 'polyline' | 'circle' | 'ellipse' | 'text'
  rect: Rect;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  rx?: number;
  x1: number; y1: number; x2: number; y2: number;
  points: string;
  markerEnd: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  textAnchor: string;
  groupId: string | null;
};

export type PageMeasure = {
  pageIndex: number;
  pageName: string;
  primitives: PrimMeasure[];
  texts: TextLeaf[];
  images: ImageLeaf[];
  decors: DecorBox[];
  svgShapes: SvgShape[];
};

const EXTRACT_SCRIPT = `(() => {
  const pickRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  // Text-leaf rect: when content overflows the layout box (scrollWidth >
  // clientWidth, no clip), the displayed text actually spans wider than the
  // border-box. Using the border-box would let PowerPoint wrap at the
  // narrower number even though the original layout shows it on one line.
  const pickTextRect = (el) => {
    const r = el.getBoundingClientRect();
    let w = r.width;
    const cs = getComputedStyle(el);
    const clipped = cs.overflow !== 'visible' && cs.overflow !== '' || cs.whiteSpace === 'nowrap' && false;
    // Inline elements: scrollWidth is meaningless on them; their bounding
    // rect already reflects the line-box content.
    if (el.nodeType === 1 && !INLINE_TAGS.has(el.tagName)) {
      if (cs.overflow === 'visible' || cs.overflow === '') {
        const sw = el.scrollWidth;
        if (sw > w + 1) w = sw;
      }
    }
    return { x: r.left, y: r.top, w, h: r.height };
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
    // Use the positioned wrapper as the rect so an image with objectFit:contain
    // shrinking inside a 540x700 panel still fills the panel in pptx.
    // Note: do NOT skip imgs inside primitives — every component is tagged
    // as a primitive, so skipping would drop all <img> elements (logos,
    // illustrations) that live inside any React component.
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

  // Pick a usable text color when CSS uses the gradient-text trick
  // (background-image linear-gradient + background-clip text + transparent color):
  // the computed color is transparent so falling back to it produces invisible
  // text in pptx. Parse the first color stop from background-image instead.
  const firstGradientColor = (bgImage) => {
    if (!bgImage || bgImage === 'none') return '';
    const m = /rgba?\\([^)]+\\)|#[0-9a-f]{3,8}/i.exec(bgImage);
    return m ? m[0] : '';
  };
  const effectiveColor = (cs) => {
    const raw = cs.color || '';
    const parsed = parseColor(raw);
    const clip = cs.webkitBackgroundClip || cs.backgroundClip || '';
    if (parsed && parsed.a === 0 && clip.includes('text')) {
      const grad = firstGradientColor(cs.backgroundImage || '');
      if (grad) return colorRgbToHex(grad) || colorRgbToHex(raw);
    }
    return colorRgbToHex(raw);
  };
  const styleSig = (el) => {
    const cs = getComputedStyle(el);
    return {
      color: effectiveColor(cs),
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === 'italic',
      mono: (cs.fontFamily || '').toLowerCase().includes('mono')
         || (cs.fontFamily || '').toLowerCase().includes('jetbrains')
         || (cs.fontFamily || '').toLowerCase().includes('cascadia')
         || (cs.fontFamily || '').toLowerCase().includes('consolas'),
    };
  };
  const collectRuns = (el) => {
    const own = styleSig(el);
    const out = [];
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const t = child.textContent;
        if (t && t.length) out.push({ text: t, ...own });
      } else if (child.nodeType === 1) {
        if (INLINE_TAGS.has(child.tagName)) {
          if (child.tagName === 'BR') {
            out.push({ text: '\\n', ...own });
          } else {
            out.push(...collectRuns(child));
          }
        }
      }
    }
    return out;
  };
  const isInlineEl = (n) => n.nodeType === 1 && INLINE_TAGS.has(n.tagName);

  const texts = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'STYLE') continue;
    if (INLINE_TAGS.has(el.tagName)) continue; // inline children are folded into parent
    if (el.closest('svg')) continue; // SVG descendants handled by the svgShapes collector

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
    // Count direct text vs text-bearing inline children. When the block has
    // 2+ inline children that each carry their own text (e.g. flex/grid
    // layout with span on each side), emitting one merged leaf at the
    // block's full width concatenates the strings and PowerPoint then re-
    // wraps everything inside that single box — losing the original spatial
    // separation. Instead emit one leaf per inline child using its own rect.
    let directTextLen = 0;
    const textInlineChildren = [];
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.textContent && c.textContent.trim()) {
        directTextLen += c.textContent.trim().length;
      } else if (c.nodeType === 1 && isInlineEl(c) && c.textContent && c.textContent.trim()) {
        textInlineChildren.push(c);
      }
    }

    // Per-text padding helper: chromium gives content-fit bounds, but
    // PowerPoint's font fallback (Cascadia for JetBrains Mono, system CJK
    // for PingFang TC / Noto Sans TC) renders wider. Pad proportional to
    // fontSize so big headings (hero / kicker) get enough slack to stay on
    // one line. The legacy +8/+4 floor still applies for small body text.
    const padRect = (r, fs) => {
      r.w += Math.max(24, fs * 0.35);
      r.h += Math.max(8, fs * 0.15);
      return r;
    };

    if (directTextLen === 0 && textInlineChildren.length >= 2) {
      for (const c of textInlineChildren) {
        const ccs = getComputedStyle(c);
        const crect = pickTextRect(c);
        if (crect.w <= 0 || crect.h <= 0) continue;
        const cfs = parsePx(ccs.fontSize);
        padRect(crect, cfs);
        texts.push({
          rect: crect,
          text: trim(c.textContent),
          runs: collectRuns(c),
          fontSize: cfs,
          fontFamily: ccs.fontFamily,
          fontWeight: parseInt(ccs.fontWeight, 10) || 400,
          color: effectiveColor(ccs),
          background: ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? colorRgbToHex(ccs.backgroundColor) : '',
          borderColor: ccs.borderTopWidth !== '0px' ? colorRgbToHex(ccs.borderTopColor) : '',
          borderRadius: parsePx(ccs.borderTopLeftRadius),
          textAlign: ccs.textAlign,
          padding: {
            t: parsePx(ccs.paddingTop),
            r: parsePx(ccs.paddingRight),
            b: parsePx(ccs.paddingBottom),
            l: parsePx(ccs.paddingLeft),
          },
          groupId: c.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
        });
      }
      continue;
    }

    const rect = pickTextRect(el);
    if (rect.w <= 0 || rect.h <= 0) continue;
    // Effective font size: when the block has no direct text node and all text
    // lives in inline children (e.g. <div><span bar/><span fontSize:30>txt</span></div>),
    // the block's own computed fontSize is the inherited default — not the
    // size the user sees. Pick the largest inline-text-bearing child's fontSize.
    let effFontSize = parsePx(cs.fontSize);
    if (directTextLen === 0 && textInlineChildren.length > 0) {
      let bestFs = 0;
      for (const c of textInlineChildren) {
        const fs = parsePx(getComputedStyle(c).fontSize);
        if (fs > bestFs) bestFs = fs;
      }
      if (bestFs > 0) effFontSize = bestFs;
    }
    padRect(rect, effFontSize);
    texts.push({
      rect,
      text: trim(el.textContent),
      runs: collectRuns(el),
      fontSize: effFontSize,
      fontFamily: cs.fontFamily,
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      color: effectiveColor(cs),
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
  // Border handling: when all 4 sides match, emit as one decor with that
  // border. When sides differ (e.g. only border-bottom for a table-row
  // separator), emit decor with no border + a synthetic line per non-zero
  // side — otherwise the row-separator hair-lines disappear entirely.
  const decors = [];
  const borderLines = [];
  for (const el of all) {
    if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'STYLE') continue;
    if (INLINE_TAGS.has(el.tagName)) continue;
    if (el.closest('svg')) continue;

    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? colorRgbToHex(cs.backgroundColor) : '';
    const sides = {
      t: { w: parsePx(cs.borderTopWidth), c: cs.borderTopColor },
      r: { w: parsePx(cs.borderRightWidth), c: cs.borderRightColor },
      b: { w: parsePx(cs.borderBottomWidth), c: cs.borderBottomColor },
      l: { w: parsePx(cs.borderLeftWidth), c: cs.borderLeftColor },
    };
    const anyBorder = sides.t.w > 0 || sides.r.w > 0 || sides.b.w > 0 || sides.l.w > 0;
    if (!bg && !anyBorder) continue;

    const rect = pickRect(el);
    if (rect.w <= 0 || rect.h <= 0) continue;
    const groupId = el.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null;

    const uniform = anyBorder
      && sides.t.w === sides.r.w && sides.t.w === sides.b.w && sides.t.w === sides.l.w
      && sides.t.c === sides.r.c && sides.t.c === sides.b.c && sides.t.c === sides.l.c;

    decors.push({
      rect,
      background: bg || '',
      borderColor: uniform ? colorRgbToHex(sides.t.c) : '',
      borderWidth: uniform ? sides.t.w : 0,
      borderRadii: [
        parsePx(cs.borderTopLeftRadius),
        parsePx(cs.borderTopRightRadius),
        parsePx(cs.borderBottomRightRadius),
        parsePx(cs.borderBottomLeftRadius),
      ],
      boxShadow: (function () {
        const sh = cs.boxShadow;
        if (!sh || sh === 'none') return null;
        const colorMatch = sh.match(/rgba?\\([^)]+\\)/);
        const nums = sh.replace(/rgba?\\([^)]+\\)/, '').trim().split(/\\s+/).map(parsePx);
        return {
          offsetX: nums[0] ?? 0,
          offsetY: nums[1] ?? 0,
          blur: nums[2] ?? 0,
          color: colorMatch ? colorRgbToHex(colorMatch[0]) : '#000000',
        };
      })(),
      groupId,
    });

    if (anyBorder && !uniform) {
      // Emit each non-zero side as a synthetic line shape so non-uniform
      // borders survive (table row separators, single-side accents, etc).
      const pushLine = (x1, y1, x2, y2, w, c) => {
        borderLines.push({
          tag: 'line',
          rect: {
            x: Math.min(x1, x2), y: Math.min(y1, y2),
            w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
          },
          fill: '', stroke: colorRgbToHex(c), strokeWidth: w, dashed: false,
          rx: 0, x1, y1, x2, y2, points: '',
          markerEnd: '',
          text: '', fontSize: 0, fontFamily: '', textAnchor: 'start',
          groupId,
        });
      };
      if (sides.t.w > 0) pushLine(rect.x, rect.y, rect.x + rect.w, rect.y, sides.t.w, sides.t.c);
      if (sides.r.w > 0) pushLine(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, sides.r.w, sides.r.c);
      if (sides.b.w > 0) pushLine(rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h, sides.b.w, sides.b.c);
      if (sides.l.w > 0) pushLine(rect.x, rect.y, rect.x, rect.y + rect.h, sides.l.w, sides.l.c);
    }
  }

  // Parse an SVG <path d="..."> into screen-space line segments.
  // Supports M/L/H/V/C/Q/Z (abs + rel). S/T/A skipped — uncommon for our decks.
  const parsePathD = (d, svgLeft, svgTop) => {
    const toks = d.match(/[a-zA-Z]|[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?/g) || [];
    let i = 0;
    const num = () => parseFloat(toks[i++]);
    const isCmd = (t) => /^[a-zA-Z]$/.test(t);
    const segs = [];
    let cx = 0, cy = 0, sx = 0, sy = 0;
    let cmd = '';
    const push = (x1, y1, x2, y2) => segs.push({
      x1: x1 + svgLeft, y1: y1 + svgTop, x2: x2 + svgLeft, y2: y2 + svgTop,
    });
    while (i < toks.length) {
      if (isCmd(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase();
      const c = cmd.toUpperCase();
      if (c === 'M') {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        cx = x; cy = y; sx = x; sy = y;
        cmd = rel ? 'l' : 'L';
        continue;
      }
      if (c === 'L') {
        let x = num(), y = num();
        if (rel) { x += cx; y += cy; }
        push(cx, cy, x, y); cx = x; cy = y; continue;
      }
      if (c === 'H') {
        let x = num();
        if (rel) x += cx;
        push(cx, cy, x, cy); cx = x; continue;
      }
      if (c === 'V') {
        let y = num();
        if (rel) y += cy;
        push(cx, cy, cx, y); cy = y; continue;
      }
      if (c === 'C') {
        let c1x = num(), c1y = num(), c2x = num(), c2y = num(), ex = num(), ey = num();
        if (rel) { c1x += cx; c1y += cy; c2x += cx; c2y += cy; ex += cx; ey += cy; }
        const N = 16;
        let px = cx, py = cy;
        for (let k = 1; k <= N; k++) {
          const t = k / N, it = 1 - t;
          const bx = it*it*it*cx + 3*it*it*t*c1x + 3*it*t*t*c2x + t*t*t*ex;
          const by = it*it*it*cy + 3*it*it*t*c1y + 3*it*t*t*c2y + t*t*t*ey;
          push(px, py, bx, by); px = bx; py = by;
        }
        cx = ex; cy = ey; continue;
      }
      if (c === 'Q') {
        let cpx = num(), cpy = num(), ex = num(), ey = num();
        if (rel) { cpx += cx; cpy += cy; ex += cx; ey += cy; }
        const N = 12;
        let px = cx, py = cy;
        for (let k = 1; k <= N; k++) {
          const t = k / N, it = 1 - t;
          const bx = it*it*cx + 2*it*t*cpx + t*t*ex;
          const by = it*it*cy + 2*it*t*cpy + t*t*ey;
          push(px, py, bx, by); px = bx; py = by;
        }
        cx = ex; cy = ey; continue;
      }
      if (c === 'Z') {
        push(cx, cy, sx, sy); cx = sx; cy = sy; continue;
      }
      break;
    }
    return segs;
  };

  const svgShapes = [];
  const SVG_TAGS = new Set(['rect','line','polyline','circle','ellipse','text','path']);
  for (const el of document.querySelectorAll('svg *')) {
    const tag = el.tagName.toLowerCase();
    if (!SVG_TAGS.has(tag)) continue;
    // <marker>/<defs> children are rendered indirectly via url(#id); their
    // own bbox is zero and would otherwise pollute the output.
    if (el.closest('marker, defs')) continue;
    const cs = getComputedStyle(el);
    if (tag === 'path') {
      const d = el.getAttribute('d') || '';
      if (!d.trim()) continue;
      const svgEl = el.closest('svg');
      if (!svgEl) continue;
      const svgRect = svgEl.getBoundingClientRect();
      const segs = parsePathD(d, svgRect.left, svgRect.top);
      if (segs.length === 0) continue;
      const stroke = cs.stroke && cs.stroke !== 'none' ? colorRgbToHex(cs.stroke) : '';
      const sw = parsePx(cs.strokeWidth);
      const dashed = !!cs.strokeDasharray && cs.strokeDasharray !== 'none';
      const me = el.getAttribute('marker-end') || '';
      const gid = el.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null;
      for (let k = 0; k < segs.length; k++) {
        const s = segs[k];
        svgShapes.push({
          tag: 'line',
          rect: {
            x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2),
            w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1),
          },
          fill: '', stroke, strokeWidth: sw, dashed,
          rx: 0,
          x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
          points: '',
          markerEnd: k === segs.length - 1 ? me : '',
          text: '', fontSize: 0, fontFamily: '', textAnchor: 'start',
          groupId: gid,
        });
      }
      continue;
    }
    const rect = pickRect(el);
    if (rect.w <= 0 && tag !== 'line') continue;
    if (rect.h <= 0 && tag !== 'line') continue;
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    let lineEndpoints = null;
    if (tag === 'line') {
      const svgEl = el.closest('svg');
      if (svgEl) {
        const svgRect = svgEl.getBoundingClientRect();
        lineEndpoints = {
          sx1: svgRect.left + x1, sy1: svgRect.top + y1,
          sx2: svgRect.left + x2, sy2: svgRect.top + y2,
        };
      }
    }
    svgShapes.push({
      tag,
      rect,
      fill: cs.fill && cs.fill !== 'none' ? colorRgbToHex(cs.fill) : '',
      stroke: cs.stroke && cs.stroke !== 'none' ? colorRgbToHex(cs.stroke) : '',
      strokeWidth: parsePx(cs.strokeWidth),
      dashed: !!cs.strokeDasharray && cs.strokeDasharray !== 'none',
      rx: parseFloat(el.getAttribute('rx') || '0'),
      x1: lineEndpoints?.sx1 ?? x1,
      y1: lineEndpoints?.sy1 ?? y1,
      x2: lineEndpoints?.sx2 ?? x2,
      y2: lineEndpoints?.sy2 ?? y2,
      points: el.getAttribute('points') || '',
      markerEnd: el.getAttribute('marker-end') || '',
      text: tag === 'text' ? (el.textContent || '').trim() : '',
      fontSize: parsePx(cs.fontSize),
      fontFamily: cs.fontFamily || '',
      textAnchor: el.getAttribute('text-anchor') || 'start',
      groupId: el.closest('[data-prim-id]')?.getAttribute('data-prim-id') || null,
    });
  }

  // Border-edge lines from HTML decor extraction join the SVG shape stream
  // so they go through the same downstream "shape" handling.
  for (const bl of borderLines) svgShapes.push(bl);

  return { primitives, texts, images, decors, svgShapes };
})()`;

export async function measureSlide(pages: PageHtml[]): Promise<PageMeasure[]> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("Executable doesn't exist") || msg.includes('browserType.launch')) {
      const hint = [
        '',
        'slide-to-pptx: Playwright Chromium is not installed.',
        '',
        'Run this once to download it (~130 MB):',
        '    npx playwright install chromium',
        '',
        'If you installed slide-to-pptx with `npm install -g`, the postinstall',
        'normally handles this — re-run with SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD',
        'unset, or use the command above against this package.',
        '',
      ].join('\n');
      const wrapped = new Error(hint);
      (wrapped as any).cause = e;
      throw wrapped;
    }
    throw e;
  }
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
      // Skip CSS animations to end state before measuring. Decks commonly
      // use entrance animations (opacity 0 → 1, width 0 → 100%) whose
      // starting state has zero width or invisible content — measuring
      // mid-animation produces empty rects or omits text entirely.
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            animation-fill-mode: forwards !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `,
      });
      // One extra rAF tick so layout reflects the post-animation state.
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      const raw = await page.evaluate(EXTRACT_SCRIPT);
      const r = raw as { primitives: any[]; texts: TextLeaf[]; images: ImageLeaf[]; decors: DecorBox[]; svgShapes: SvgShape[] };
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
      out.push({
        pageIndex: p.pageIndex,
        pageName: p.pageName,
        primitives,
        texts: r.texts,
        images: r.images,
        decors: r.decors,
        svgShapes: r.svgShapes,
      });
    }
  } finally {
    await browser.close();
  }
  return out;
}
