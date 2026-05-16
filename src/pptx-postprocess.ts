// src/pptx-postprocess.ts
import { readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  preserveOrder: true,
  trimValues: false,
});
const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  suppressEmptyNode: false,
});

// Each shape's name attribute lives at:
// <p:sp> -> <p:nvSpPr>[0] -> <p:cNvPr>[0]  @_name
function shapeName(node: any): string | undefined {
  const tag = Object.keys(node).find((k) => k.startsWith('p:'));
  if (!tag) return undefined;
  const children = node[tag];
  if (!Array.isArray(children)) return undefined;
  for (const c of children) {
    const k = Object.keys(c)[0];
    if (k === 'p:nvSpPr' || k === 'p:nvPicPr' || k === 'p:nvGrpSpPr') {
      const inner = c[k];
      for (const ic of inner) {
        const ik = Object.keys(ic)[0];
        if (ik === 'p:cNvPr') {
          return ic[':@']?.['@_name'];
        }
      }
    }
  }
  return undefined;
}

// Group key for a shape name like "p5-Box-3/rect" → "p5-Box-3"
function groupKey(name: string | undefined): string | null {
  if (!name) return null;
  const slash = name.lastIndexOf('/');
  if (slash <= 0) return null;
  return name.slice(0, slash);
}

function nextGrpSpId(used: Set<number>): number {
  let n = 1000;
  while (used.has(n)) n++;
  used.add(n);
  return n;
}

function collectUsedIds(spTree: any[], used: Set<number>) {
  for (const node of spTree) {
    const tag = Object.keys(node).find((k) => k.startsWith('p:'));
    if (!tag) continue;
    for (const c of node[tag]) {
      const k = Object.keys(c)[0];
      if (k === 'p:nvSpPr' || k === 'p:nvPicPr' || k === 'p:nvGrpSpPr') {
        for (const ic of c[k]) {
          if (Object.keys(ic)[0] === 'p:cNvPr') {
            const id = ic[':@']?.['@_id'];
            if (id) used.add(Number(id));
          }
        }
      }
    }
  }
}

function unionBbox(rects: Array<{ x: number; y: number; w: number; h: number }>) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

function shapeBbox(node: any): { x: number; y: number; w: number; h: number } | null {
  const tag = Object.keys(node).find((k) => k.startsWith('p:'));
  if (!tag) return null;
  for (const c of node[tag]) {
    const ck = Object.keys(c)[0];
    if (ck === 'p:spPr' || ck === 'p:grpSpPr') {
      const inner = c[ck];
      for (const ic of inner) {
        if (Object.keys(ic)[0] === 'a:xfrm') {
          const xfrmKids = ic['a:xfrm'];
          let off, ext;
          for (const x of xfrmKids) {
            const xk = Object.keys(x)[0];
            if (xk === 'a:off') off = x[':@'];
            if (xk === 'a:ext') ext = x[':@'];
          }
          if (off && ext) {
            return {
              x: Number(off['@_x']),
              y: Number(off['@_y']),
              w: Number(ext['@_cx']),
              h: Number(ext['@_cy']),
            };
          }
        }
      }
    }
  }
  return null;
}

function wrapGroup(
  members: any[],
  groupId: string,
  used: Set<number>,
): any {
  const rects = members.map(shapeBbox).filter((b): b is NonNullable<typeof b> => !!b);
  const bbox = rects.length > 0 ? unionBbox(rects) : { x: 0, y: 0, w: 0, h: 0 };
  const id = nextGrpSpId(used);
  return {
    'p:grpSp': [
      {
        'p:nvGrpSpPr': [
          { 'p:cNvPr': [], ':@': { '@_id': String(id), '@_name': groupId } },
          { 'p:cNvGrpSpPr': [] },
          { 'p:nvPr': [] },
        ],
      },
      {
        'p:grpSpPr': [
          {
            'a:xfrm': [
              { 'a:off': [], ':@': { '@_x': String(bbox.x), '@_y': String(bbox.y) } },
              { 'a:ext': [], ':@': { '@_cx': String(bbox.w), '@_cy': String(bbox.h) } },
              { 'a:chOff': [], ':@': { '@_x': String(bbox.x), '@_y': String(bbox.y) } },
              { 'a:chExt': [], ':@': { '@_cx': String(bbox.w), '@_cy': String(bbox.h) } },
            ],
          },
        ],
      },
      ...members,
    ],
  };
}

function processSpTree(spTreeChildren: any[]): any[] {
  let work = [...spTreeChildren];
  const used = new Set<number>();
  collectUsedIds(work, used);

  let changed = true;
  while (changed) {
    changed = false;
    const byDeepKey = new Map<string, number[]>();
    for (let i = 0; i < work.length; i++) {
      const n = shapeName(work[i]);
      const k = groupKey(n);
      if (!k) continue;
      let arr = byDeepKey.get(k);
      if (!arr) { arr = []; byDeepKey.set(k, arr); }
      arr.push(i);
    }

    let target: { key: string; idxs: number[] } | null = null;
    for (const [k, idxs] of byDeepKey) {
      if (idxs.length < 2) continue;
      if (!target || k.split('/').length > target.key.split('/').length) {
        target = { key: k, idxs };
      }
    }
    if (!target) break;
    const sorted = [...target.idxs].sort((a, b) => a - b);
    const contiguous = sorted.every((v, j) => j === 0 || v === sorted[j - 1] + 1);
    if (!contiguous) {
      console.warn('[postprocess] non-contiguous group members for', target.key, '— flat emit retained');
      break;
    }
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    const members = work.slice(start, end + 1);
    const wrapped = wrapGroup(members, target.key, used);
    work = [...work.slice(0, start), wrapped, ...work.slice(end + 1)];
    changed = true;
  }

  return work;
}

export async function postprocessPptx(pptxPath: string): Promise<void> {
  const buf = await readFile(pptxPath);
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));

  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath)!.async('string');
    const tree: any[] = parser.parse(xml);
    const sld = tree.find((n) => 'p:sld' in n);
    if (!sld) continue;
    const sldKids = sld['p:sld'];
    const cSld = sldKids.find((n: any) => 'p:cSld' in n);
    if (!cSld) continue;
    const cSldKids = cSld['p:cSld'];
    const spTreeIdx = cSldKids.findIndex((n: any) => 'p:spTree' in n);
    if (spTreeIdx < 0) continue;
    const spTreeChildren = cSldKids[spTreeIdx]['p:spTree'];
    cSldKids[spTreeIdx]['p:spTree'] = processSpTree(spTreeChildren);
    const newXml = builder.build(tree);
    zip.file(slidePath, newXml);
  }

  const outBuf = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(pptxPath, outBuf);
}
