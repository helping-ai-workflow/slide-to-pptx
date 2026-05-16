import pptxgen from 'pptxgenjs';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IRItem, IRPage } from './types.js';
import type { IRGroup, IRImageV2, IRItemV2, IRPageV2, IRRichText, IRShape, IRDecorBox, Run } from './types.js';

const FONT_MAP = {
  mono: 'JetBrains Mono',
  body: 'Segoe UI',
  display: 'JetBrains Mono',
};
const DEFAULT_BODY = 'Segoe UI';

const CANVAS_W_PX = 1920;
const CANVAS_H_PX = 1080;
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const PX_PER_INCH_X = CANVAS_W_PX / SLIDE_W_IN; // 144
const PX_PER_INCH_Y = CANVAS_H_PX / SLIDE_H_IN; // 144

const px = (p: number) => p / PX_PER_INCH_X;
const py = (p: number) => p / PX_PER_INCH_Y;

// Canvas 1920x1080 px maps to 13.333x7.5 inch (144 canvas-px/inch).
// Font sizes use the same scale: 1 canvas-px = 72/144 = 0.5 pt.
const fpt = (p: number) => +(p * 0.5).toFixed(2);

const hex = (c?: string) => {
  if (!c) return '000000';
  const s = c.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^[0-9a-fA-F]{8}$/.test(s)) return s.slice(0, 6).toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return (s[0] + s[0] + s[1] + s[1] + s[2] + s[2]).toUpperCase();
  }
  return '1A1F2E';
};

const MONO = 'JetBrains Mono';
const BODY = 'Segoe UI';

function renderBox(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'Box' }>) {
  const x = px(it.x);
  const y = py(it.y);
  const w = px(it.w);
  const h = py(it.h);

  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.06,
    fill: { color: hex(it.fill ?? '#ffffff') },
    line: { color: hex(it.color), width: 1.5 },
  });

  if (it.sub) {
    slide.addText(it.label, {
      x, y: y, w, h: h / 2,
      align: 'center', valign: 'bottom',
      fontFace: MONO, fontSize: fpt(22), bold: true,
      color: '1a1f2e',
    });
    slide.addText(it.sub, {
      x, y: y + h / 2, w, h: h / 2,
      align: 'center', valign: 'top',
      fontFace: MONO, fontSize: fpt(16),
      color: '64748b',
    });
  } else {
    slide.addText(it.label, {
      x, y, w, h,
      align: 'center', valign: 'middle',
      fontFace: MONO, fontSize: fpt(22), bold: true,
      color: '1a1f2e',
    });
  }
}

function renderArrow(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'Arrow' }>) {
  const x1 = px(it.x1), y1 = py(it.y1);
  const x2 = px(it.x2), y2 = py(it.y2);
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  // pptxgenjs 'line' with flipH/flipV for direction
  slide.addShape('line', {
    x, y, w: Math.max(w, 0.01), h: Math.max(h, 0.01),
    line: {
      color: hex(it.color),
      width: 1.5,
      dashType: it.dashed ? 'dash' : 'solid',
      endArrowType: 'triangle',
    },
    flipH: x1 > x2,
    flipV: y1 > y2,
  });

  if (it.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - py(20);
    slide.addText(it.label, {
      x: mx - 1, y: my, w: 2, h: 0.25,
      align: 'center',
      fontFace: MONO, fontSize: fpt(16),
      color: hex(it.color),
    });
  }
}

function renderPageHeading(
  slide: pptxgen.Slide,
  it: Extract<IRItem, { kind: 'PageHeading' }>,
) {
  const x = px(it.x);
  const y = py(it.y);
  slide.addText(`§ ${it.num} · ${it.kicker}`, {
    x, y, w: px(1720), h: 0.4,
    fontFace: MONO, fontSize: fpt(20),
    color: '0891B2',
    charSpacing: 2,
  });
  slide.addText(it.title, {
    x, y: y + 0.4, w: px(1720), h: 0.9,
    fontFace: BODY, fontSize: fpt(60), bold: true,
    color: '1A1F2E',
    valign: 'top',
    autoFit: true,
  } as any);
}

function renderFooterRule(slide: pptxgen.Slide) {
  slide.addShape('rect', {
    x: px(100), y: py(1080 - 100), w: px(1720), h: 0.012,
    fill: { color: '0891b2', transparency: 78 },
    line: { type: 'none' },
  });
}

function renderFooterLabel(
  slide: pptxgen.Slide,
  it: Extract<IRItem, { kind: 'FooterLabel' }>,
) {
  slide.addText(it.text, {
    x: px(100), y: py(1080 - 56 - 24), w: px(1500), h: 0.3,
    fontFace: MONO, fontSize: fpt(20),
    color: '64748b',
    charSpacing: 4,
  });
}

function renderPageNum(
  slide: pptxgen.Slide,
  it: Extract<IRItem, { kind: 'PageNum' }>,
) {
  const n = String(it.n).padStart(2, '0');
  const total = String(it.total).padStart(2, '0');
  slide.addText(`${n} / ${total}`, {
    x: px(1920 - 100 - 400), y: py(1080 - 56 - 28), w: px(400), h: 0.5,
    align: 'right', valign: 'middle',
    fontFace: BODY, fontSize: fpt(20),
    color: '64748B',
  });
}

function renderParamRow(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'ParamRow' }>) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  // bottom rule
  slide.addShape('rect', {
    x, y: y + h - 0.012, w, h: 0.012,
    fill: { color: '0891b2', transparency: 78 },
    line: { type: 'none' },
  });
  const padTop = py(22);
  const col1W = px(320), col2W = px(200), col3W = px(140);
  const colGap = px(24);
  const c1 = x;
  const c2 = c1 + col1W + colGap;
  const c3 = c2 + col2W + colGap;
  const c4 = c3 + col3W + colGap;
  const descW = x + w - c4;
  const rowY = y + padTop;
  const rowH = h - py(44);
  slide.addText(it.name, {
    x: c1, y: rowY, w: col1W, h: rowH,
    fontFace: MONO, fontSize: fpt(26), bold: true,
    color: hex(it.color),
  });
  slide.addText(it.range, {
    x: c2, y: rowY, w: col2W, h: rowH,
    fontFace: MONO, fontSize: fpt(22), color: '64748b',
  });
  slide.addText(it.def, {
    x: c3, y: rowY, w: col3W, h: rowH,
    fontFace: MONO, fontSize: fpt(22), color: '1a1f2e',
  });
  slide.addText(it.desc, {
    x: c4, y: rowY, w: descW, h: rowH,
    fontFace: BODY, fontSize: fpt(22), color: '334155',
  });
}

function renderBitField(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'BitField' }>) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  slide.addShape('rect', {
    x, y, w, h: 0.04,
    fill: { color: hex(it.color) },
    line: { type: 'none' },
  });
  slide.addText(it.bits, {
    x, y: y + 0.08, w, h: 0.3,
    fontFace: MONO, fontSize: fpt(16), color: '64748b',
    charSpacing: 1,
  });
  slide.addText(it.label, {
    x, y: y + 0.3, w, h: 0.3,
    fontFace: MONO, fontSize: fpt(20), bold: true,
    color: hex(it.color),
  });
}

function renderGate(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'Gate' }>) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  slide.addShape('roundRect', {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: 'ffffff' },
    line: { color: 'C2410C', width: 1.5 },
  });
  const padX = px(24), padY = py(24);
  const innerW = w - padX * 2;
  const nameH = 0.5;
  const srcH = 0.32;
  const descGap = 0.12;
  const descY = y + padY + nameH + descGap;
  const descMaxY = y + h - padY - srcH - 0.05;
  const descH = Math.max(descMaxY - descY, 0.1);
  slide.addText(it.name, {
    x: x + padX, y: y + padY, w: innerW, h: nameH,
    fontFace: BODY, fontSize: fpt(24), bold: true,
    color: 'C2410C', valign: 'top', wrap: false, autoFit: true,
  } as any);
  slide.addText(it.desc, {
    x: x + padX, y: descY, w: innerW, h: descH,
    fontFace: BODY, fontSize: fpt(18), color: '334155',
    valign: 'top', autoFit: true,
  } as any);
  slide.addText(it.src, {
    x: x + padX, y: y + h - padY - srcH, w: innerW, h: srcH,
    fontFace: MONO, fontSize: fpt(16), color: '64748B',
    charSpacing: 1, valign: 'top',
  });
}

function renderFSMNode(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'FSMNode' }>) {
  const cx = px(it.x), cy = py(it.y);
  const w = px(it.w), h = py(72);
  slide.addShape('roundRect', {
    x: cx - w / 2, y: cy - h / 2, w, h, rectRadius: h / 2,
    fill: { color: 'eef1f5' },
    line: { color: hex(it.color), width: 1.5 },
  });
  slide.addText(it.label, {
    x: cx - w / 2, y: cy - h / 2, w, h,
    align: 'center', valign: 'middle',
    fontFace: MONO, fontSize: fpt(20), bold: true,
    color: '1a1f2e',
  });
}

function renderTextBlock(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'TextBlock' }>) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  if (w <= 0 || h <= 0) return;
  if (it.background || it.borderColor) {
    slide.addShape('roundRect', {
      x, y, w, h, rectRadius: 0.05,
      fill: it.background && it.background.startsWith('#')
        ? { color: hex(it.background) }
        : it.background
          ? { color: 'f0f4f8' }
          : { color: 'ffffff', transparency: 100 },
      line: it.borderColor
        ? { color: hex(it.borderColor), width: 1 }
        : { type: 'none' },
    });
  }
  if (!it.text || !it.text.trim()) return;
  const pad = it.padding ? py(it.padding) : 0;
  const fam = it.fontFamily ? FONT_MAP[it.fontFamily] : DEFAULT_BODY;
  const tw = Math.max(w - pad * 2, 0.1);
  const th = Math.max(h - pad * 2, 0.1);
  const fs = Math.max(fpt(it.fontSize), 6);
  // Centered text inside a styled wrapper (background/border) — typical
  // "formula" / "callout" block: vertically center too.
  const centerV = it.align === 'center' && (it.background || it.borderColor);
  slide.addText(it.text, {
    x: x + pad, y: y + pad, w: tw, h: th,
    fontFace: fam,
    fontSize: fs,
    color: it.color && it.color.startsWith('#') ? hex(it.color) : '1A1F2E',
    bold: !!it.bold,
    align: (it.align as any) || 'left',
    valign: centerV ? 'middle' : 'top',
    autoFit: it.fontSize >= 48 ? true : undefined,
    wrap: it.fontSize >= 80 ? false : true,
  } as any);
}

function renderAgendaRow(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'AgendaRow' }>) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  slide.addShape('rect', {
    x, y: y + h - 0.012, w, h: 0.012,
    fill: { color: '0891b2', transparency: 78 }, line: { type: 'none' },
  });
  const padTop = py(22);
  const c1W = px(90), c2W = px(0); // c2 takes 1fr
  const c3W = px(220), c4W = px(200);
  const c1 = x;
  const c2 = c1 + c1W;
  const c4 = x + w - c4W;
  const c3 = c4 - c3W;
  const c2Width = c3 - c2;
  const rowY = y + padTop;
  const rowH = h - py(44);
  slide.addText(it.id, {
    x: c1, y: rowY, w: c1W, h: rowH,
    fontFace: MONO, fontSize: fpt(30), bold: true,
    color: '0891b2', valign: 'middle',
  });
  slide.addText(it.title, {
    x: c2, y: rowY, w: c2Width, h: rowH,
    fontFace: BODY, fontSize: fpt(32),
    color: '1a1f2e', valign: 'middle',
  });
  slide.addText(it.pages, {
    x: c3, y: rowY, w: c3W, h: rowH,
    fontFace: MONO, fontSize: fpt(24),
    color: '64748b', valign: 'middle',
  });
  slide.addText(it.aud, {
    x: c4, y: rowY, w: c4W, h: rowH,
    fontFace: MONO, fontSize: fpt(20),
    color: '64748b', valign: 'middle', charSpacing: 2,
  });
}

function renderProgressTrack(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'ProgressTrack' }>) {
  const trackY = 0;
  const trackH = py(6);
  slide.addShape('rect', {
    x: 0, y: trackY, w: SLIDE_W_IN, h: trackH,
    fill: { color: '0891b2', transparency: 90 }, line: { type: 'none' },
  });
  const ratio = it.total > 0 ? it.n / it.total : 0;
  slide.addShape('rect', {
    x: 0, y: trackY, w: SLIDE_W_IN * ratio, h: trackH,
    fill: { color: '0891b2' }, line: { type: 'none' },
  });
}

function renderImage(
  slide: pptxgen.Slide,
  it: Extract<IRItem, { kind: 'Image' }>,
  assetRoot: string,
) {
  const x = px(it.x), y = py(it.y), w = px(it.w), h = py(it.h);
  if (it.src.startsWith('data:')) {
    slide.addImage({ data: it.src, x, y, w, h, sizing: { type: 'contain', w, h } });
    return;
  }
  let resolved: string;
  if (it.src.startsWith('file://')) {
    resolved = fileURLToPath(it.src);
  } else if (path.isAbsolute(it.src)) {
    resolved = it.src;
  } else {
    resolved = path.resolve(assetRoot, it.src);
  }
  if (!existsSync(resolved)) {
    slide.addText(`[missing image: ${it.src.slice(0, 80)}]`, {
      x, y, w, h, fontFace: MONO, fontSize: 10, color: 'AA0000',
    });
    return;
  }
  slide.addImage({ path: resolved, x, y, w, h, sizing: { type: 'contain', w, h } });
}

function renderUnsupported(slide: pptxgen.Slide, it: Extract<IRItem, { kind: 'Unsupported' }>) {
  slide.addText(`[unsupported: ${it.name}]`, {
    x: px(it.x), y: py(it.y), w: 4, h: 0.4,
    fontFace: MONO, fontSize: 10, color: 'aa0000',
  });
}

export async function buildPptx(pages: IRPage[], outPath: string, assetRoot = process.cwd()) {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'CANVAS', width: SLIDE_W_IN, height: SLIDE_H_IN });
  pres.layout = 'CANVAS';

  for (const page of pages) {
    const slide = pres.addSlide();
    slide.background = { color: 'f7f5f0' };

    for (const it of page.items) {
      switch (it.kind) {
        case 'Box': renderBox(slide, it); break;
        case 'Arrow': renderArrow(slide, it); break;
        case 'PageHeading': renderPageHeading(slide, it); break;
        case 'FooterRule': renderFooterRule(slide); break;
        case 'FooterLabel': renderFooterLabel(slide, it); break;
        case 'PageNum': renderPageNum(slide, it); break;
        case 'ParamRow': renderParamRow(slide, it); break;
        case 'BitField': renderBitField(slide, it); break;
        case 'Gate': renderGate(slide, it); break;
        case 'FSMNode': renderFSMNode(slide, it); break;
        case 'TextBlock': renderTextBlock(slide, it); break;
        case 'AgendaRow': renderAgendaRow(slide, it); break;
        case 'ProgressTrack': renderProgressTrack(slide, it); break;
        case 'Image': renderImage(slide, it, assetRoot); break;
        case 'Unsupported': renderUnsupported(slide, it); break;
      }
    }
  }
  await pres.writeFile({ fileName: outPath });
}

// ─── V2 Generic Mappers ───────────────────────────────────────────────────────

function nameFor(group: string[] | null, localId: string): string {
  return group && group.length > 0 ? `${group.join('/')}/${localId}` : localId;
}

function renderRichText(
  slide: pptxgen.Slide,
  it: IRRichText,
  groupChain: string[] | null,
) {
  const x = px(it.rect.x), y = py(it.rect.y);
  const w = Math.max(px(it.rect.w), 0.05);
  const h = Math.max(py(it.rect.h), 0.05);
  const fam = it.fontFamily ? FONT_MAP[it.fontFamily] : DEFAULT_BODY;
  const fs = Math.max(fpt(it.fontSize), 6);
  const runs = it.runs.map((r) => ({
    text: r.text,
    options: {
      color: r.color ? hex(r.color) : undefined,
      bold: r.bold || undefined,
      italic: r.italic || undefined,
      fontFace: r.mono ? MONO : undefined,
    },
  }));
  slide.addText(runs as any, {
    x, y, w, h,
    fontFace: fam,
    fontSize: fs,
    align: (it.align as any) || 'left',
    valign: (it.valign as any) || 'top',
    objectName: nameFor(groupChain, it.id),
  } as any);
}

function renderShape(
  slide: pptxgen.Slide,
  it: IRShape,
  groupChain: string[] | null,
) {
  const x = px(it.rect.x), y = py(it.rect.y);
  const w = Math.max(px(it.rect.w), 0.01);
  const h = Math.max(py(it.rect.h), 0.01);
  const common = {
    x, y, w, h,
    fill: it.fill ? { color: hex(it.fill) } : { type: 'none' as const },
    line: it.stroke
      ? { color: hex(it.stroke), width: it.strokeWidth ?? 1, dashType: it.dashed ? 'dash' : 'solid' }
      : { type: 'none' as const },
    objectName: nameFor(groupChain, it.id),
  } as any;
  if (it.shape === 'line') {
    slide.addShape('line', {
      ...common,
      line: {
        ...common.line,
        endArrowType: it.endArrow ? 'triangle' : undefined,
      },
      flipH: it.flipH, flipV: it.flipV,
    });
  } else if (it.shape === 'roundRect') {
    slide.addShape('roundRect', { ...common, rectRadius: it.rectRadius ?? 0.05 });
  } else if (it.shape === 'ellipse') {
    slide.addShape('ellipse', common);
  } else {
    slide.addShape('rect', common);
  }
}

function renderDecor(
  slide: pptxgen.Slide,
  it: IRDecorBox,
  groupChain: string[] | null,
) {
  const x = px(it.rect.x), y = py(it.rect.y);
  const w = Math.max(px(it.rect.w), 0.05);
  const h = Math.max(py(it.rect.h), 0.05);
  const maxR = Math.max(...it.borderRadii);
  const useRound = maxR > 0;
  slide.addShape(useRound ? 'roundRect' : 'rect', {
    x, y, w, h,
    rectRadius: useRound ? Math.min(0.5, maxR / Math.min(it.rect.w, it.rect.h)) : 0,
    fill: it.background
      ? { color: hex(it.background) }
      : { color: 'FFFFFF', transparency: 100 },
    line: it.borderColor
      ? { color: hex(it.borderColor), width: it.borderWidth || 1 }
      : { type: 'none' },
    shadow: it.boxShadow ? {
      type: 'outer',
      offset: it.boxShadow.offsetX,
      blur: it.boxShadow.blur,
      color: hex(it.boxShadow.color),
      opacity: 0.4,
    } : undefined,
    objectName: nameFor(groupChain, it.id),
  } as any);
}

function renderImageV2(
  slide: pptxgen.Slide,
  it: IRImageV2,
  groupChain: string[] | null,
  assetRoot: string,
) {
  const x = px(it.rect.x), y = py(it.rect.y);
  const w = Math.max(px(it.rect.w), 0.05);
  const h = Math.max(py(it.rect.h), 0.05);
  const objectName = nameFor(groupChain, it.id);
  if (it.src.startsWith('data:')) {
    slide.addImage({ data: it.src, x, y, w, h, sizing: { type: 'contain', w, h }, objectName } as any);
    return;
  }
  let resolved: string;
  if (it.src.startsWith('file://')) {
    resolved = fileURLToPath(it.src);
  } else if (path.isAbsolute(it.src)) {
    resolved = it.src;
  } else {
    resolved = path.resolve(assetRoot, it.src);
  }
  if (!existsSync(resolved)) {
    slide.addText(`[missing image: ${it.src.slice(0, 80)}]`, {
      x, y, w, h, fontFace: MONO, fontSize: 10, color: 'AA0000', objectName,
    } as any);
    return;
  }
  slide.addImage({ path: resolved, x, y, w, h, sizing: { type: 'contain', w, h }, objectName } as any);
}

function renderItemV2(
  slide: pptxgen.Slide,
  it: IRItemV2,
  groupChain: string[],
  assetRoot: string,
) {
  switch (it.kind) {
    case 'Group': {
      const chain = [...groupChain, it.id];
      for (const child of it.children) renderItemV2(slide, child, chain, assetRoot);
      return;
    }
    case 'Shape': renderShape(slide, it, groupChain); return;
    case 'RichText': renderRichText(slide, it, groupChain); return;
    case 'Decor': renderDecor(slide, it, groupChain); return;
    case 'ImageV2': renderImageV2(slide, it, groupChain, assetRoot); return;
  }
}

export async function buildPptxV2(pages: IRPageV2[], outPath: string, assetRoot = process.cwd()) {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'CANVAS', width: SLIDE_W_IN, height: SLIDE_H_IN });
  pres.layout = 'CANVAS';
  for (const page of pages) {
    const slide = pres.addSlide();
    slide.background = { color: 'F7F5F0' };
    for (const it of page.items) renderItemV2(slide, it, [], assetRoot);
  }
  await pres.writeFile({ fileName: outPath });
}
