import React from 'react';
import ReactDOMServer from 'react-dom/server';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSlideModule } from './load-slide.js';
import { instrumentTree, type PrimRecord } from './instrument.js';

export type PageHtml = {
  pageIndex: number;
  pageName: string;
  html: string;
  primitives: PrimRecord[];
};

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function rewriteAssetUrls(html: string, slideDir: string): string {
  // Slide module's asset imports were stubbed to their relative specifier
  // (e.g. "./assets/foo.png"). Convert to absolute file:// URLs so playwright
  // (loading via data: or file:) can resolve them.
  return html.replace(/(src|href)="(\.\/[^"]+)"/g, (_m, attr, rel) => {
    const abs = path.resolve(slideDir, rel);
    return `${attr}="${pathToFileURL(abs).href}"`;
  });
}

function htmlShell(body: string, designCss: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<style>
:root { ${designCss} }
html, body { margin: 0; padding: 0; }
body {
  width: 1920px; height: 1080px;
  font-family: var(--osd-font-body, sans-serif);
  color: var(--osd-text, #1a1f2e);
  background: var(--osd-bg, #ffffff);
  overflow: hidden;
  position: relative;
  font-size: 16px;
}
h1, h2, h3, h4, h5, h6, p, ul, ol { margin: 0; padding: 0; }
</style>
</head><body>${body}</body></html>`;
}

function designToCss(design: any): string {
  const p = design?.palette ?? {};
  const f = design?.fonts ?? {};
  const parts: string[] = [];
  if (p.bg) parts.push(`--osd-bg: ${p.bg};`);
  if (p.text) parts.push(`--osd-text: ${p.text};`);
  if (p.accent) parts.push(`--osd-accent: ${p.accent};`);
  if (f.display) parts.push(`--osd-font-display: ${f.display};`);
  if (f.body) parts.push(`--osd-font-body: ${f.body};`);
  return parts.join(' ');
}

export async function renderSlideHtml(slideDir: string): Promise<PageHtml[]> {
  const mod = await loadSlideModule(slideDir);
  const pages = (mod as any).default as Array<() => React.ReactNode>;
  if (!Array.isArray(pages)) throw new Error('slide module default export must be an array of pages');
  const designCss = designToCss((mod as any).design);

  const out: PageHtml[] = [];
  for (let i = 0; i < pages.length; i++) {
    const PageFn = pages[i] as any;
    const pageName = PageFn?.displayName || PageFn?.name || `page-${i}`;
    let body = '';
    let primitives: PrimRecord[] = [];
    try {
      const raw = React.createElement(PageFn);
      const { tree, primitives: prims } = instrumentTree(raw, `pg${i}`);
      primitives = prims;
      body = ReactDOMServer.renderToStaticMarkup(tree as any);
    } catch (e: any) {
      body = `<div style="color:red;padding:40px">extract error: ${escAttr(String(e?.message ?? e))}</div>`;
    }
    body = rewriteAssetUrls(body, slideDir);
    out.push({ pageIndex: i, pageName, html: htmlShell(body, designCss), primitives });
  }
  return out;
}
