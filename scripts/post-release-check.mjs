#!/usr/bin/env node
// Plan K K-3: post-release pixel-diff gate. For every primimg:<srcPrimId>:...
// image shape inside an emitted pptx, re-render the source primitive in
// isolation (same hide-non-descendants logic as src/extract-pw.ts K-1) and
// pixelmatch the embedded PNG vs the fresh isolated render. Fails if any
// diff > threshold. Catches mid-pipeline contamination (sibling-bake
// regressions) that the existing whole-image pre-release gate cannot detect.
//
// Entry points used by scripts/visual-regression.mjs:
//   runPostReleaseCheck(decks, thresholdConfig) → { anyFail, results }
//
// Pure helpers used by tests/post-release-check.test.ts:
//   isPrimimgObjectName(name) → boolean
//   parsePrimimgObjectName(name) → { srcPrimId } | null

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { renderSlideHtml } from '../src/render-html.ts';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

// Pure helpers — exported for unit tests.

export function isPrimimgObjectName(name) {
  return typeof name === 'string' && name.startsWith('primimg:');
}

export function parsePrimimgObjectName(name) {
  if (!isPrimimgObjectName(name)) return null;
  const after = name.slice('primimg:'.length);
  // Convention: name is `primimg:<srcPrimId>:<baseName>` where <baseName>
  // ends with `/primimg-N`. srcPrimId may contain `/` (group chain) but
  // never `:`. The LAST `:` separates srcPrimId from baseName.
  const lastColon = after.lastIndexOf(':');
  if (lastColon < 0) return null;
  return { srcPrimId: after.slice(0, lastColon) };
}

// XML tree walker — find every <p:pic> with a primimg:* name.
// Returns array of { embedId, srcPrimId, objectName }.
function findPrimimgPicShapes(tree) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === ':@') continue;
      const val = node[key];
      if (key === 'p:pic' && Array.isArray(val)) {
        const info = extractPicInfo(val);
        if (info && isPrimimgObjectName(info.objectName)) {
          const parsed = parsePrimimgObjectName(info.objectName);
          if (parsed && info.embedId) {
            out.push({
              embedId: info.embedId,
              srcPrimId: parsed.srcPrimId,
              objectName: info.objectName,
            });
          }
        }
      }
      if (Array.isArray(val)) walk(val);
      else if (val && typeof val === 'object') walk(val);
    }
  }
  walk(tree);
  return out;
}

// Inside a <p:pic> children array, locate cNvPr's @_name and blip's @_r:embed.
function extractPicInfo(picChildren) {
  let objectName;
  let embedId;
  for (const child of picChildren) {
    if (!child || typeof child !== 'object') continue;
    for (const key of Object.keys(child)) {
      if (key === ':@') continue;
      const inner = child[key];
      if (key === 'p:nvPicPr' && Array.isArray(inner)) {
        for (const c of inner) {
          if (c && typeof c === 'object' && 'p:cNvPr' in c) {
            objectName = c[':@']?.['@_name'];
          }
        }
      }
      if (key === 'p:blipFill' && Array.isArray(inner)) {
        for (const c of inner) {
          if (c && typeof c === 'object' && 'a:blip' in c) {
            embedId = c[':@']?.['@_r:embed'];
          }
        }
      }
    }
  }
  return objectName ? { objectName, embedId } : null;
}

function parseRels(xml) {
  // Minimal rels parser — maps rId → Target. Uses non-preserveOrder mode
  // for simpler access; we only need the attribute map.
  const flatParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
  });
  const tree = flatParser.parse(xml);
  const rels = tree?.Relationships?.Relationship;
  const map = new Map();
  const arr = Array.isArray(rels) ? rels : rels ? [rels] : [];
  for (const rel of arr) {
    if (rel['@_Id'] && rel['@_Target']) {
      map.set(rel['@_Id'], rel['@_Target']);
    }
  }
  return map;
}

// Map a rels Target like "../media/image-1-1.png" → "ppt/media/image-1-1.png"
function resolveMediaPath(target, slidePath) {
  // slidePath is like "ppt/slides/slide1.xml". The Target is relative to it,
  // typically "../media/..." → "ppt/media/...".
  const slideDir = path.posix.dirname(slidePath);
  let abs = path.posix.normalize(path.posix.join(slideDir, target));
  // Strip any leading "./" that normalize might leave behind.
  abs = abs.replace(/^\.\//, '');
  return abs;
}

async function extractPrimimgFromPptx(pptxPath) {
  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);
  const out = [];
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const an = parseInt(a.match(/slide(\d+)\.xml$/)[1], 10);
      const bn = parseInt(b.match(/slide(\d+)\.xml$/)[1], 10);
      return an - bn;
    });
  for (const slidePath of slidePaths) {
    const slideNumber = parseInt(slidePath.match(/slide(\d+)\.xml$/)[1], 10);
    const xml = await zip.file(slidePath).async('string');
    const tree = parser.parse(xml);
    const matches = findPrimimgPicShapes(tree);
    if (matches.length === 0) continue;
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relsFile = zip.file(relsPath);
    if (!relsFile) continue;
    const relsXml = await relsFile.async('string');
    const rels = parseRels(relsXml);
    for (const m of matches) {
      const target = rels.get(m.embedId);
      if (!target) continue;
      const mediaPath = resolveMediaPath(target, slidePath);
      const mediaFile = zip.file(mediaPath);
      if (!mediaFile) continue;
      const pngBytes = await mediaFile.async('nodebuffer');
      out.push({ slideNumber, srcPrimId: m.srcPrimId, embeddedPngBuffer: pngBytes });
    }
  }
  return out;
}

// Same hide-non-descendants logic as src/extract-pw.ts K-1 — kept in sync by
// construction (both apply visibility:hidden to every body descendant that
// isn't the target, an ancestor of target, or a descendant of target).
async function renderPrimitiveIsolated(page, srcPrimId) {
  await page.evaluate((id) => {
    const target = document.querySelector(`[data-prim-id="${id}"]`);
    if (!target) return;
    const all = document.body.querySelectorAll('*');
    const hidden = [];
    for (const p of Array.from(all)) {
      if (p === target) continue;
      if (target.contains(p)) continue;
      if (p.contains(target)) continue;
      const el = p;
      el.setAttribute('data-prim-orig-vis', el.style.visibility);
      el.style.visibility = 'hidden';
      hidden.push(el);
    }
    window.__primIsolated = hidden;
  }, srcPrimId);
  try {
    const escapedId = srcPrimId.replace(/"/g, '\\"');
    const locator = page.locator(`[data-prim-id="${escapedId}"]`);
    return await locator.first().screenshot({ omitBackground: true, type: 'png' });
  } finally {
    await page.evaluate(() => {
      const hidden = window.__primIsolated || [];
      for (const el of hidden) {
        el.style.visibility = el.getAttribute('data-prim-orig-vis') || '';
        el.removeAttribute('data-prim-orig-vis');
      }
      delete window.__primIsolated;
    });
  }
}

function diffPngBuffers(a, b) {
  let pngA, pngB;
  try {
    pngA = PNG.sync.read(a);
    pngB = PNG.sync.read(b);
  } catch (e) {
    return { ratio: 1, reason: `png decode failed: ${e.message}` };
  }
  if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
    return {
      ratio: 1,
      reason: `size mismatch: ${pngA.width}x${pngA.height} vs ${pngB.width}x${pngB.height}`,
    };
  }
  const diff = new PNG({ width: pngA.width, height: pngA.height });
  const diffPx = pixelmatch(
    pngA.data, pngB.data, diff.data, pngA.width, pngA.height,
    { threshold: 0.1 },
  );
  const total = pngA.width * pngA.height;
  return { ratio: diffPx / total, diffPx, total };
}

function postReleaseThresholdFor(deckName, srcPrimId, config) {
  const o = config?.postRelease?.overrides?.[deckName]?.[srcPrimId];
  if (typeof o?.max === 'number') return o.max;
  return typeof config?.postRelease?.default === 'number'
    ? config.postRelease.default
    : 0.01;
}

// Main entry — invoked from scripts/visual-regression.mjs.
// `decks` is `Array<{ name, path }>`. Returns { anyFail, results } where
// results = Array<{ deck, slide?, srcPrimId?, ratio?, threshold?, ok?,
//                  primimgCount?, reason? }>.
export async function runPostReleaseCheck(decks, thresholdConfig) {
  const results = [];
  let anyFail = false;

  // Phase 1: extract primimg triples per deck. No browser yet.
  const perDeckTriples = [];
  for (const deck of decks) {
    const baseName = path.basename(deck.path);
    const pptxPath = path.join(deck.path, `${baseName}.pptx`);
    if (!existsSync(pptxPath)) {
      perDeckTriples.push({ deck, triples: [], missing: true });
      continue;
    }
    const triples = await extractPrimimgFromPptx(pptxPath);
    perDeckTriples.push({ deck, triples });
  }

  // Phase 2: pre-render HTML for every deck that has triples (so we can
  // navigate per-slide). Skip decks without primimg shapes.
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { deck, triples, missing } of perDeckTriples) {
      if (missing) {
        results.push({ deck: deck.name, primimgCount: 0, reason: 'pptx not found' });
        continue;
      }
      if (triples.length === 0) {
        results.push({ deck: deck.name, primimgCount: 0 });
        continue;
      }
      // Render HTML for the deck and pre-stage per-page bodies.
      const { pages: htmlPages } = await renderSlideHtml(deck.path);
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      try {
        // Group triples by slide so we can load each slide's HTML once.
        const bySlide = new Map();
        for (const t of triples) {
          if (!bySlide.has(t.slideNumber)) bySlide.set(t.slideNumber, []);
          bySlide.get(t.slideNumber).push(t);
        }
        for (const [slideNumber, slideTriples] of bySlide) {
          const htmlPage = htmlPages[slideNumber - 1];
          if (!htmlPage) {
            for (const t of slideTriples) {
              results.push({
                deck: deck.name,
                slide: slideNumber,
                srcPrimId: t.srcPrimId,
                ratio: 1,
                threshold: postReleaseThresholdFor(deck.name, t.srcPrimId, thresholdConfig),
                ok: false,
                reason: `no HTML page for slide ${slideNumber}`,
              });
              anyFail = true;
            }
            continue;
          }
          await page.setContent(htmlPage.html, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts?.ready);
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
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
          for (const t of slideTriples) {
            let isolatedBuf;
            try {
              isolatedBuf = await renderPrimitiveIsolated(page, t.srcPrimId);
            } catch (e) {
              const threshold = postReleaseThresholdFor(deck.name, t.srcPrimId, thresholdConfig);
              results.push({
                deck: deck.name,
                slide: slideNumber,
                srcPrimId: t.srcPrimId,
                ratio: 1,
                threshold,
                ok: false,
                reason: `isolated re-render failed: ${e.message}`,
              });
              anyFail = true;
              continue;
            }
            const d = diffPngBuffers(t.embeddedPngBuffer, isolatedBuf);
            const threshold = postReleaseThresholdFor(deck.name, t.srcPrimId, thresholdConfig);
            const ok = d.ratio <= threshold;
            if (!ok) anyFail = true;
            results.push({
              deck: deck.name,
              slide: slideNumber,
              srcPrimId: t.srcPrimId,
              ratio: d.ratio,
              threshold,
              ok,
              ...(d.reason ? { reason: d.reason } : {}),
            });
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return { anyFail, results };
}
