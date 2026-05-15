import React from 'react';
import { loadSlideModule } from './load-slide.js';
import type { IRItem, IRPage } from './types.js';

const PRIMITIVES = new Set([
  'Box',
  'Arrow',
  'PageHeading',
  'FooterRule',
  'FooterLabel',
  'PageNum',
  'ProgressTrack',
  'AudienceChips',
  'AgendaRow',
  'ParamRow',
  'BitField',
  'Gate',
  'FSMNode',
]);

const CANVAS_W = 1920;
const CANVAS_H = 1080;

type FlowKind = 'block' | 'row' | 'svg' | 'none';

type Frame = {
  // absolute origin of this frame on canvas
  ox: number;
  oy: number;
  w: number;
  h: number;
  flow: FlowKind;
  cursorX: number; // for row
  cursorY: number; // for block
  gap: number;
  gateSlotCount: number; // pre-counted flex:1 Gate siblings
  gateSlotW: number; // resolved width per Gate
};

const ROW_H_PARAMROW = 90;
const ROW_H_HEADER = 56;
const ROW_H_TEXT_DEFAULT = 80;
const BIT_H = 78;

function num(v: any): number {
  return typeof v === 'number' ? v : 0;
}

function nameOf(t: any): string {
  return (t && (t.displayName || t.name)) || '';
}

function containsPrimitive(node: any): boolean {
  if (node == null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(containsPrimitive);
  if (!React.isValidElement(node)) return false;
  const el = node as React.ReactElement<any>;
  const { type, props } = el;
  if (typeof type === 'function') {
    if (PRIMITIVES.has(nameOf(type))) return true;
    try {
      const rendered = (type as any)(props);
      return containsPrimitive(rendered);
    } catch {
      return false;
    }
  }
  if (typeof type === 'string') {
    if (type === 'img' || type === 'svg') return true;
    return React.Children.toArray((props as any)?.children).some(containsPrimitive);
  }
  return false;
}

function flatText(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatText).join('');
  if (!React.isValidElement(node)) return '';
  const el = node as React.ReactElement<any>;
  const { type, props } = el;
  if (typeof type === 'function') {
    try {
      const rendered = (type as any)(props);
      return flatText(rendered);
    } catch {
      return '';
    }
  }
  return flatText((props as any)?.children);
}

function countGateChildren(node: any): number {
  if (!React.isValidElement(node)) return 0;
  let n = 0;
  for (const c of React.Children.toArray((node.props as any)?.children)) {
    if (React.isValidElement(c) && nameOf((c as any).type) === 'Gate') n += 1;
  }
  return n;
}

function pickFontFamily(style: any): 'mono' | 'body' | 'display' | undefined {
  if (!style?.fontFamily) return undefined;
  const f = String(style.fontFamily);
  if (f.includes('osd-font-display')) return 'display';
  if (f.includes('Mono') || f.includes('Consolas') || f.includes('osd-font-body') === false && f.includes('mono')) return 'mono';
  return 'body';
}

function makeRootFrame(): Frame {
  return {
    ox: 0, oy: 0, w: CANVAS_W, h: CANVAS_H,
    flow: 'none', cursorX: 0, cursorY: 0, gap: 0,
    gateSlotCount: 0, gateSlotW: 0,
  };
}

function record(name: string, props: any, frame: Frame, items: IRItem[]) {
  switch (name) {
    case 'Box':
      items.push({
        kind: 'Box',
        x: frame.ox + num(props.x), y: frame.oy + num(props.y),
        w: num(props.w), h: num(props.h),
        label: props.label, sub: props.sub,
        color: props.color, fill: props.fill,
      });
      return;
    case 'Arrow':
      items.push({
        kind: 'Arrow',
        x1: frame.ox + num(props.x1), y1: frame.oy + num(props.y1),
        x2: frame.ox + num(props.x2), y2: frame.oy + num(props.y2),
        color: props.color, label: props.label, dashed: !!props.dashed,
      });
      return;
    case 'FSMNode': {
      const w = num(props.w) || 200;
      items.push({
        kind: 'FSMNode',
        x: frame.ox + num(props.x),
        y: frame.oy + num(props.y),
        w,
        label: props.label,
        color: props.color || '#0891b2',
      });
      return;
    }
    case 'PageHeading':
      items.push({
        kind: 'PageHeading',
        x: frame.ox, y: frame.oy,
        num: props.num, kicker: props.kicker, title: props.title,
      });
      return;
    case 'FooterRule': items.push({ kind: 'FooterRule' }); return;
    case 'FooterLabel': items.push({ kind: 'FooterLabel', text: props.text }); return;
    case 'PageNum':
      items.push({ kind: 'PageNum', n: props.n, total: props.total });
      items.push({ kind: 'ProgressTrack', n: props.n, total: props.total });
      return;
    case 'ProgressTrack':
      items.push({ kind: 'ProgressTrack', n: props.n, total: props.total });
      return;
    case 'AudienceChips': return;
    case 'AgendaRow': {
      const item = props.item || {};
      const x = frame.ox;
      const y = frame.oy + frame.cursorY;
      const w = frame.w;
      const h = 90;
      items.push({
        kind: 'AgendaRow',
        x, y, w, h,
        id: item.id, title: item.title, pages: item.pages, aud: item.aud,
      });
      frame.cursorY += h;
      return;
    }
    case 'ParamRow': {
      const x = frame.ox;
      const y = frame.oy + frame.cursorY;
      const w = frame.w;
      const h = ROW_H_PARAMROW;
      items.push({
        kind: 'ParamRow',
        x, y, w, h,
        name: props.name, range: props.range,
        def: props.def, desc: props.desc, color: props.color,
      });
      frame.cursorY += h;
      return;
    }
    case 'BitField': {
      const w = num(props.width) || 120;
      const x = frame.ox + frame.cursorX;
      const y = frame.oy + frame.cursorY;
      items.push({
        kind: 'BitField',
        x, y, w, h: BIT_H,
        bits: props.bits, label: props.label, color: props.color,
      });
      frame.cursorX += w + frame.gap;
      return;
    }
    case 'Gate': {
      const slotW = frame.gateSlotW > 0 ? frame.gateSlotW : Math.floor((frame.w - frame.gap * (frame.gateSlotCount - 1)) / Math.max(frame.gateSlotCount, 1));
      const x = frame.ox + frame.cursorX;
      const y = frame.oy;
      const h = 360;
      items.push({
        kind: 'Gate',
        x, y, w: slotW, h,
        name: props.name, desc: props.desc, src: props.src,
      });
      frame.cursorX += slotW + frame.gap;
      return;
    }
    default:
      items.push({
        kind: 'Unsupported',
        name, x: frame.ox, y: frame.oy + frame.cursorY,
      });
      frame.cursorY += 40;
      return;
  }
}

function tryEnterAbsoluteFrame(
  style: any,
  parent: Frame,
  hasGates: number,
  hasPrimitive: boolean,
  isFlexRow: boolean,
  isFlexNoChild: boolean,
): Frame | null {
  if (!style || style.position !== 'absolute') return null;

  // Resolve x, y
  let x = parent.ox;
  let y = parent.oy;
  if (typeof style.left === 'number') x = parent.ox + style.left;
  if (typeof style.top === 'number') y = parent.oy + style.top;
  if (typeof style.right === 'number' && typeof style.width === 'number') {
    x = parent.ox + parent.w - style.right - style.width;
  }
  if (typeof style.bottom === 'number' && typeof style.height === 'number') {
    y = parent.oy + parent.h - style.bottom - style.height;
  }

  // Resolve width
  let w = parent.w;
  if (typeof style.width === 'number') w = style.width;
  else if (typeof style.left === 'number' && typeof style.right === 'number') {
    w = parent.w - style.left - style.right;
  }
  // Resolve height
  let h = ROW_H_TEXT_DEFAULT;
  if (typeof style.height === 'number') h = style.height;
  else if (typeof style.top === 'number' && typeof style.bottom === 'number') {
    h = parent.h - style.top - style.bottom;
  }

  // For bottom-anchored boxes w/o height: estimate by fontSize + padding
  if (typeof style.bottom === 'number' && typeof style.height !== 'number'
      && typeof style.top !== 'number') {
    const fs = num(style.fontSize) || 20;
    const pad = num(style.padding) || 0;
    h = Math.round(fs * 2.2 + pad * 2);
    y = parent.oy + parent.h - style.bottom - h;
  }

  const gap = num(style.gap);
  const flow: FlowKind = isFlexRow ? 'row' : hasPrimitive ? 'block' : 'block';
  const gateSlotW = hasGates > 0 && isFlexRow
    ? Math.floor((w - gap * (hasGates - 1)) / hasGates)
    : 0;

  return {
    ox: x, oy: y, w, h,
    flow,
    cursorX: 0, cursorY: 0,
    gap,
    gateSlotCount: hasGates,
    gateSlotW,
  };
}

type WalkCtx = {
  frame: Frame;
  inSVG: boolean;
};

// Walk children of an absolute frame that contains a mix of inline text divs
// and recognised primitives. Maintain a flow cursor and emit text blocks at
// the cursor position, while letting primitive record() advance the same
// cursor for in-flow primitives (ParamRow, BitField, Gate, AgendaRow).
function walkFrameChildrenInFlow(
  el: React.ReactElement<any>,
  frame: Frame,
  parentStyle: any,
  items: IRItem[],
): void {
  const children = React.Children.toArray((el.props as any)?.children);
  const wrapperPad = num(parentStyle?.padding);
  const innerX = frame.ox + wrapperPad;
  const innerY = frame.oy + wrapperPad;
  const innerW = frame.w - wrapperPad * 2;
  const isFlexRow = parentStyle?.display === 'flex'
    && (parentStyle?.flexDirection === 'row' || parentStyle?.flexDirection == null);
  const gap = num(parentStyle?.gap);

  // Optional decorative wrapper rect for background/border — height is
  // patched after we know how much content was emitted.
  let wrapperRect: IRItem | null = null;
  if (parentStyle?.background || parentStyle?.border) {
    wrapperRect = {
      kind: 'TextBlock',
      x: frame.ox, y: frame.oy, w: frame.w, h: frame.h,
      text: '',
      fontSize: 1,
      color: '#000000',
      background: typeof parentStyle?.background === 'string' ? parentStyle.background : undefined,
      borderColor: typeof parentStyle?.border === 'string'
        ? parentStyle.border.match(/#[0-9a-fA-F]{3,8}/)?.[0]
        : undefined,
      padding: 0,
    };
    items.push(wrapperRect);
  }

  // Pre-count primitives that need slot allocation (Gate in flex-row)
  let gateCount = 0;
  if (isFlexRow) {
    for (const c of children) {
      if (React.isValidElement(c) && nameOf((c as any).type) === 'Gate') gateCount++;
    }
  }

  let cx = 0;
  let cy = 0;

  for (const c of children) {
    if (c == null || typeof c === 'boolean') continue;
    if (typeof c === 'string' || typeof c === 'number') continue;
    if (!React.isValidElement(c)) continue;
    const cEl = c as React.ReactElement<any>;
    const cType = cEl.type;
    const cProps = cEl.props as any;
    const cStyle = cProps?.style;

    // Function component → primitive or composite
    if (typeof cType === 'function') {
      const name = nameOf(cType);
      if (PRIMITIVES.has(name)) {
        const subFrame: Frame = {
          ...frame,
          ox: innerX, oy: innerY + cy, w: innerW,
          cursorX: cx, cursorY: 0, gap,
          flow: isFlexRow ? 'row' : 'block',
          gateSlotCount: gateCount,
          gateSlotW: gateCount > 0 ? Math.floor((innerW - gap * (gateCount - 1)) / gateCount) : 0,
        };
        record(name, cProps, subFrame, items);
        if (isFlexRow) cx = subFrame.cursorX;
        else cy += subFrame.cursorY;
        continue;
      }
      try {
        const rendered = (cType as any)(cProps);
        walk(rendered, { frame, inSVG: false }, items);
      } catch {}
      continue;
    }

    // Host element
    if (typeof cType === 'string') {
      if (cType === 'img') {
        const src = cProps?.src;
        if (src) {
          const h = 200;
          items.push({
            kind: 'Image',
            x: innerX, y: innerY + cy, w: innerW, h,
            src, alt: cProps?.alt,
          });
          cy += h;
        }
        continue;
      }

      const hasPrim = containsPrimitive(cEl);
      if (hasPrim) {
        // Nested wrapper containing primitives → recurse in flow
        const subIsFlex = cStyle?.display === 'flex'
          && (cStyle?.flexDirection === 'row' || cStyle?.flexDirection == null);
        const subFrame: Frame = {
          ox: innerX,
          oy: innerY + cy,
          w: innerW,
          h: Math.max(frame.h - cy - wrapperPad * 2, 60),
          flow: subIsFlex ? 'row' : 'block',
          cursorX: 0, cursorY: 0,
          gap: num(cStyle?.gap),
          gateSlotCount: 0, gateSlotW: 0,
        };
        walkFrameChildrenInFlow(cEl, subFrame, cStyle ?? {}, items);
        cy += subIsFlex ? BIT_H + 20 : Math.max(subFrame.cursorY, BIT_H);
        continue;
      }

      const text = flatText(cProps?.children).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const tag = cType;
      const tagFS = defaultFontSizeForTag(tag);
      const fs = num(cStyle?.fontSize) || tagFS || num(parentStyle?.fontSize) || 20;
      const mt = num(cStyle?.marginTop);
      const mb = num(cStyle?.marginBottom);
      const tagBold = tag === 'h1' || tag === 'h2' || tag === 'h3'
        || tag === 'h4' || tag === 'strong';
      const blockH = estimateBlockHeight(text, fs, innerW);
      items.push(buildTextBlock(text, innerX, innerY + cy + mt, innerW, blockH, {
        fontSize: fs, ...cStyle,
        fontWeight: tagBold ? 700 : cStyle?.fontWeight,
      }));
      cy += mt + blockH + mb;
      continue;
    }
  }

  // Patch wrapper rect to span actual content height
  if (wrapperRect && wrapperRect.kind === 'TextBlock') {
    const finalH = Math.max(cy + wrapperPad * 2, frame.h);
    wrapperRect.h = finalH;
  }
}

function buildTextBlock(
  text: string,
  x: number, y: number, w: number, h: number,
  style: any,
): IRItem {
  return {
    kind: 'TextBlock',
    x, y, w, h, text,
    fontSize: num(style?.fontSize) || 20,
    color: typeof style?.color === 'string' ? style.color : '#1a1f2e',
    fontFamily: pickFontFamily(style),
    bold: style?.fontWeight === 700 || style?.fontWeight === 800
      || style?.fontWeight === 'bold',
    align: (style?.textAlign as any) ?? 'left',
    background: typeof style?.background === 'string' ? style.background : undefined,
    borderColor: typeof style?.border === 'string'
      ? style.border.match(/#[0-9a-fA-F]{3,8}/)?.[0]
      : undefined,
    padding: num(style?.padding),
  };
}

function estimateBlockHeight(text: string, fontSize: number, widthPx: number): number {
  // assume ~0.55 em per CJK char, ~0.5 em per ASCII; mix → 0.55
  const charW = fontSize * 0.55;
  const charsPerLine = Math.max(Math.floor(widthPx / charW), 8);
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  return Math.ceil(lines * fontSize * 1.5) + 8;
}

const BLOCK_TAGS = new Set([
  'div', 'p', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'pre', 'blockquote',
]);

function getChildBlocks(el: React.ReactElement<any>): React.ReactElement<any>[] {
  const out: React.ReactElement<any>[] = [];
  for (const c of React.Children.toArray((el.props as any)?.children)) {
    if (React.isValidElement(c)) {
      const t = (c as any).type;
      if (typeof t === 'string' && BLOCK_TAGS.has(t)) {
        out.push(c as any);
      }
    }
  }
  return out;
}

function defaultFontSizeForTag(tag: string): number {
  switch (tag) {
    case 'h1': return 64;
    case 'h2': return 48;
    case 'h3': return 36;
    case 'h4': return 28;
    case 'h5': return 22;
    case 'h6': return 18;
    default: return 0;
  }
}

function emitTextBlocks(
  el: React.ReactElement<any>,
  frame: Frame,
  parentStyle: any,
  items: IRItem[],
): void {
  const children = getChildBlocks(el);
  const wrapperPad = num(parentStyle?.padding);
  const innerX = frame.ox + wrapperPad;
  const innerY = frame.oy + wrapperPad;
  const innerW = frame.w - wrapperPad * 2;

  // Wrapper styling (background / border) — emit as background rect first if present.
  if (parentStyle?.background || parentStyle?.border) {
    items.push({
      kind: 'TextBlock',
      x: frame.ox, y: frame.oy, w: frame.w, h: frame.h,
      text: '',
      fontSize: 1,
      color: '#000000',
      background: typeof parentStyle?.background === 'string' ? parentStyle.background : undefined,
      borderColor: typeof parentStyle?.border === 'string'
        ? parentStyle.border.match(/#[0-9a-fA-F]{3,8}/)?.[0]
        : undefined,
      padding: 0,
    });
  }

  if (children.length <= 1) {
    const text = flatText((el.props as any)?.children).replace(/\s+/g, ' ').trim();
    if (text) {
      const fs = num(parentStyle?.fontSize) || 20;
      const estH = estimateBlockHeight(text, fs, innerW);
      const blockH = Math.max(frame.h - wrapperPad * 2, estH);
      items.push(buildTextBlock(text, innerX, innerY, innerW, blockH, parentStyle));
    }
    return;
  }

  // For flex-row containers, fold children into a single TextBlock per child
  // but lay them out side-by-side instead of stacking vertically.
  const isFlexRow = parentStyle?.display === 'flex'
    && (parentStyle?.flexDirection === 'row' || parentStyle?.flexDirection == null);

  let cy = innerY;
  let cx = innerX;
  const parentSansChrome = { ...parentStyle, background: undefined, border: undefined };
  const justifyEnd = parentStyle?.justifyContent === 'space-between'
    || parentStyle?.justifyContent === 'flex-end';

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const cStyle = (child.props as any)?.style;
    const tag = (child.type as string);
    const innerBlocks = getChildBlocks(child);
    if (innerBlocks.length >= 2) {
      // child itself contains multiple block children → recurse so they split,
      // otherwise flex-row entries with sub-structure get flattened.
      const slotW = isFlexRow ? Math.floor(innerW / children.length) : innerW;
      const slotX = isFlexRow
        ? (justifyEnd && i === children.length - 1
            ? innerX + innerW - slotW
            : cx)
        : innerX;
      const slotY = isFlexRow ? innerY : cy;
      const subFrame: Frame = {
        ...frame, ox: slotX, oy: slotY,
        w: slotW, h: Math.max(frame.h - (slotY - frame.oy), 40),
      };
      // Pass *only* the child's own style — inherited display:flex etc must
      // not leak into a non-flex child container.
      emitTextBlocks(child, subFrame, cStyle ?? {}, items);
      if (isFlexRow) cx += slotW;
      else cy += subFrame.h;
      continue;
    }
    const text = flatText((child.props as any)?.children).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const tagFS = defaultFontSizeForTag(tag);
    const fs = num(cStyle?.fontSize) || tagFS || num(parentStyle?.fontSize) || 20;
    const mt = num(cStyle?.marginTop);
    const mb = num(cStyle?.marginBottom);
    const tagBold = tag === 'h1' || tag === 'h2' || tag === 'h3'
      || tag === 'h4' || tag === 'strong';

    if (isFlexRow) {
      const slotW = Math.floor(innerW / children.length);
      const h = estimateBlockHeight(text, fs, slotW);
      const slotX = justifyEnd && i === children.length - 1
        ? innerX + innerW - slotW
        : cx;
      items.push(buildTextBlock(text, slotX, innerY, slotW, h, {
        fontSize: fs, ...parentSansChrome, ...cStyle,
        fontWeight: tagBold ? 700 : cStyle?.fontWeight,
      }));
      cx += slotW;
    } else {
      const h = estimateBlockHeight(text, fs, innerW);
      items.push(buildTextBlock(text, innerX, cy + mt, innerW, h, {
        fontSize: fs, ...parentSansChrome, ...cStyle,
        fontWeight: tagBold ? 700 : cStyle?.fontWeight,
      }));
      cy += mt + h + mb;
    }
  }
}

function walk(node: any, ctx: WalkCtx, items: IRItem[]): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, ctx, items);
    return;
  }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<any>;
  const { type, props } = el;

  // Primitive function components
  if (typeof type === 'function') {
    const name = nameOf(type);
    if (PRIMITIVES.has(name)) {
      record(name, props, ctx.frame, items);
      return;
    }
    try {
      const rendered = (type as any)(props);
      walk(rendered, ctx, items);
    } catch (err) {
      // skip pages that throw (e.g. require useState — out of spike scope)
      items.push({ kind: 'Unsupported', name: name || '<anon>', x: 0, y: 0 });
    }
    return;
  }

  // Host elements
  if (typeof type === 'string') {
    const style = (props as any)?.style;
    const children = (props as any)?.children;

    // Enter SVG: viewBox 1:1 assumed
    if (type === 'svg') {
      const ox = ctx.frame.ox + num(style?.left);
      const oy = ctx.frame.oy + num(style?.top);
      const w = num(style?.width) || ctx.frame.w;
      const h = num(style?.height) || ctx.frame.h;
      const svgFrame: Frame = {
        ox, oy, w, h, flow: 'svg',
        cursorX: 0, cursorY: 0, gap: 0,
        gateSlotCount: 0, gateSlotW: 0,
      };
      walk(children, { frame: svgFrame, inSVG: true }, items);
      return;
    }

    // Inside SVG: just recurse host elements; primitives handled via function component path
    if (ctx.inSVG) {
      walk(children, ctx, items);
      return;
    }

    // <img> tag: emit image at parent-frame's bounds
    if (type === 'img') {
      const src = (props as any)?.src;
      if (typeof src === 'string' && src.length > 0) {
        items.push({
          kind: 'Image',
          x: ctx.frame.ox, y: ctx.frame.oy,
          w: ctx.frame.w, h: ctx.frame.h,
          src, alt: (props as any)?.alt,
        });
      }
      return;
    }

    // Absolute-positioned wrapper
    if (style && style.position === 'absolute') {
      const isFlexRow = style.display === 'flex'
        && (style.flexDirection === 'row' || style.flexDirection == null);
      const gateCount = isFlexRow ? countGateChildren(el) : 0;
      const hasPrim = containsPrimitive(el);
      const frame = tryEnterAbsoluteFrame(
        style, ctx.frame, gateCount, hasPrim, isFlexRow, false,
      );
      if (!frame) {
        walk(children, ctx, items);
        return;
      }

      if (!hasPrim) {
        // text-only absolute block — split into per-child TextBlocks
        emitTextBlocks(el, frame, style, items);
        return;
      }

      // Mixed: contains both inline text and primitives → unified flow walker
      walkFrameChildrenInFlow(el, frame, style, items);
      return;
    }

    // Non-absolute host: pass through, do not change frame
    walk(children, ctx, items);
    return;
  }
}

export type ExtractOptions = {
  pageIndex?: number;
  pageName?: string;
};

export async function extractPage(
  slideDir: string,
  opts: ExtractOptions = {},
): Promise<IRPage> {
  const mod = await loadSlideModule(slideDir);
  const pages = mod.default;
  if (!Array.isArray(pages)) {
    throw new Error('slide module default export is not an array');
  }
  let index = opts.pageIndex ?? 0;
  if (opts.pageName) {
    const found = pages.findIndex(
      (p: any) => nameOf(p) === opts.pageName,
    );
    if (found < 0) throw new Error(`page not found: ${opts.pageName}`);
    index = found;
  }
  return extractOne(pages[index] as any, index);
}

export async function extractAllPages(slideDir: string): Promise<IRPage[]> {
  const mod = await loadSlideModule(slideDir);
  const pages = mod.default;
  const out: IRPage[] = [];
  for (let i = 0; i < pages.length; i++) {
    try {
      out.push(extractOne(pages[i] as any, i));
    } catch (err: any) {
      out.push({
        pageId: `${i}`,
        pageIndex: i,
        pageName: nameOf(pages[i]) || `page-${i}`,
        size: { w: CANVAS_W as 1920, h: CANVAS_H as 1080 },
        items: [{ kind: 'Unsupported', name: `extract-error:${String(err?.message ?? err)}`, x: 0, y: 0 }],
      });
    }
  }
  return out;
}

function extractOne(PageFn: any, index: number): IRPage {
  const tree = PageFn();
  const items: IRItem[] = [];
  walk(tree, { frame: makeRootFrame(), inSVG: false }, items);
  return {
    pageId: `${index}`,
    pageIndex: index,
    pageName: nameOf(PageFn) || `page-${index}`,
    size: { w: CANVAS_W as 1920, h: CANVAS_H as 1080 },
    items,
  };
}
