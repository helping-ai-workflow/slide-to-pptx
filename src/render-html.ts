import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSlideModule } from './load-slide.js';
import { instrumentTree, type PrimRecord } from './instrument.js';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export type PageHtml = {
  pageIndex: number;
  pageName: string;
  html: string;
  primitives: PrimRecord[];
};

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function rewriteAssetUrls(html: string, slideDir: string, assetMap: Map<string, string>): Promise<string> {
  // Slide module's asset imports were stubbed to their relative specifier
  // (e.g. "./assets/foo.png"). Inline as data: URLs so headless chromium does
  // not need filesystem access and the natural image size loads correctly.
  const matches = [...html.matchAll(/(src|href)="(\.\/[^"]+)"/g)];
  for (const m of matches) {
    const rel = m[2];
    if (assetMap.has(rel)) continue;
    const abs = path.resolve(slideDir, rel);
    try {
      const buf = await readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      const mime = MIME[ext] ?? 'application/octet-stream';
      assetMap.set(rel, `data:${mime};base64,${buf.toString('base64')}`);
    } catch {
      assetMap.set(rel, rel); // missing — leave as-is
    }
  }
  return html.replace(/(src|href)="(\.\/[^"]+)"/g, (_m, attr, rel) => {
    return `${attr}="${assetMap.get(rel) ?? rel}"`;
  });
}

function htmlShell(body: string, designCss: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<style>
:root { ${designCss} }
*, *::before, *::after { box-sizing: border-box; }
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

  const assetMap = new Map<string, string>();
  const out: PageHtml[] = [];
  for (let i = 0; i < pages.length; i++) {
    const PageFn = pages[i] as any;
    const pageName = PageFn?.displayName || PageFn?.name || `page-${i}`;
    let body = '';
    let primitives: PrimRecord[] = [];
    try {
      const raw = React.createElement(PageFn);
      const { tree, primitives: prims } = instrumentTree(raw, `pg${i}`, { skipRoot: true });
      primitives = prims;
      body = ReactDOMServer.renderToStaticMarkup(tree as any);
    } catch (e: any) {
      body = `<div style="color:red;padding:40px">extract error: ${escAttr(String(e?.message ?? e))}</div>`;
    }
    body = await rewriteAssetUrls(body, slideDir, assetMap);
    out.push({ pageIndex: i, pageName, html: htmlShell(body, designCss), primitives });
  }
  return out;
}
