import pptxgen from 'pptxgenjs';
import type { IRItem, IRPage } from './types.js';

const CANVAS_W_PX = 1920;
const CANVAS_H_PX = 1080;
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const PX_PER_INCH_X = CANVAS_W_PX / SLIDE_W_IN; // 144
const PX_PER_INCH_Y = CANVAS_H_PX / SLIDE_H_IN; // 144

const px = (p: number) => p / PX_PER_INCH_X;
const py = (p: number) => p / PX_PER_INCH_Y;

// 1 px ≈ 0.75 pt for font sizes (web px → pt)
const fpt = (p: number) => +(p * 0.75).toFixed(2);

const hex = (c?: string) => (c ? c.replace('#', '') : '000000');

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
    color: '0891b2',
    charSpacing: 2,
  });
  slide.addText(it.title, {
    x, y: y + 0.4, w: px(1720), h: 1.2,
    fontFace: BODY, fontSize: fpt(72), bold: true,
    color: '1a1f2e',
  });
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
  slide.addText(`${it.n} / ${it.total}`, {
    x: px(1920 - 100 - 200), y: py(1080 - 56 - 24), w: px(200), h: 0.3,
    align: 'right',
    fontFace: MONO, fontSize: fpt(20),
    color: '64748b',
    charSpacing: 4,
  });
}

export async function buildPptx(pages: IRPage[], outPath: string) {
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
      }
    }
  }
  await pres.writeFile({ fileName: outPath });
}
