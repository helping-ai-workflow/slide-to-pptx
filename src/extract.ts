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
  'AudienceChips',
  'ParamRow',
  'BitField',
  'Gate',
  'FSMNode',
]);

type Ctx = { x: number; y: number };

function record(name: string, props: any, ctx: Ctx, items: IRItem[]) {
  switch (name) {
    case 'Box':
      items.push({
        kind: 'Box',
        x: ctx.x + (props.x ?? 0),
        y: ctx.y + (props.y ?? 0),
        w: props.w,
        h: props.h,
        label: props.label,
        sub: props.sub,
        color: props.color,
        fill: props.fill,
      });
      return;
    case 'Arrow':
      items.push({
        kind: 'Arrow',
        x1: ctx.x + (props.x1 ?? 0),
        y1: ctx.y + (props.y1 ?? 0),
        x2: ctx.x + (props.x2 ?? 0),
        y2: ctx.y + (props.y2 ?? 0),
        color: props.color,
        label: props.label,
        dashed: !!props.dashed,
      });
      return;
    case 'PageHeading':
      items.push({
        kind: 'PageHeading',
        x: ctx.x,
        y: ctx.y,
        num: props.num,
        kicker: props.kicker,
        title: props.title,
      });
      return;
    case 'FooterRule':
      items.push({ kind: 'FooterRule' });
      return;
    case 'FooterLabel':
      items.push({ kind: 'FooterLabel', text: props.text });
      return;
    case 'PageNum':
      items.push({ kind: 'PageNum', n: props.n, total: props.total });
      return;
    case 'AudienceChips':
      // null-rendering chrome — skip
      return;
    default:
      // ParamRow/BitField/Gate/FSMNode not in spike scope yet
      items.push({ kind: 'Box', x: ctx.x, y: ctx.y, w: 0, h: 0,
        label: `[unsupported:${name}]`, color: '#999' } as any);
      return;
  }
}

function readOffset(style: any): { dx: number; dy: number } {
  if (!style) return { dx: 0, dy: 0 };
  // Only count absolute positioning with top/left set
  if (style.position !== 'absolute') return { dx: 0, dy: 0 };
  const dx = typeof style.left === 'number' ? style.left : 0;
  const dy = typeof style.top === 'number' ? style.top : 0;
  return { dx, dy };
}

function walk(node: any, ctx: Ctx, items: IRItem[]): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, ctx, items);
    return;
  }
  if (!React.isValidElement(node)) return;
  const el = node as React.ReactElement<any>;
  const { type, props } = el;

  if (typeof type === 'function') {
    const name = (type as any).displayName || (type as any).name;
    if (PRIMITIVES.has(name)) {
      record(name, props, ctx, items);
      return;
    }
    // composite — invoke and recurse
    const rendered = (type as any)(props);
    walk(rendered, ctx, items);
    return;
  }

  if (typeof type === 'string') {
    const { dx, dy } = readOffset((props as any)?.style);
    const next: Ctx = { x: ctx.x + dx, y: ctx.y + dy };
    walk((props as any)?.children, next, items);
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
      (p: any) => (p?.displayName || p?.name) === opts.pageName,
    );
    if (found < 0) throw new Error(`page not found: ${opts.pageName}`);
    index = found;
  }
  const PageFn = pages[index] as any;
  const tree = PageFn();
  const items: IRItem[] = [];
  walk(tree, { x: 0, y: 0 }, items);
  return {
    pageId: `${index}`,
    pageIndex: index,
    pageName: PageFn.displayName || PageFn.name || `page-${index}`,
    size: { w: 1920, h: 1080 },
    items,
  };
}
