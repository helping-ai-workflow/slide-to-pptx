# slide-to-pptx

Convert open-slide React decks into editable PowerPoint (.pptx).

## Status

**Spike** — one page (`SystemDiagram` from `my-slide/slides/mac-merge-tx-spec`) round-trips:
React tree → IR JSON → editable .pptx with native shapes, lines and text.

```
slide React tree
  → walker (extract.ts)        # identify declared primitives by function name
  → IR JSON                    # { kind, x, y, w, h, ... } per item
  → pptxgenjs mapper           # one mapper per kind
  → .pptx                      # native rectangles / lines / text frames
```

Verified on `SystemDiagram` (9 Box + 7 Arrow + page chrome):

* coordinate transform across nested `position:absolute` + SVG viewBox: ±25 EMU
* all 9 Box rects + labels emitted as native shapes (selectable / editable)
* all 7 Arrow lines + 4 labels emitted with correct direction & dash style
* PageHeading / FooterRule / FooterLabel / PageNum rendered to chrome
* CJK text preserved (`IP 在 MAC Top 中的位置`)

## Install

Published on npm as `@helping-ai-workflow/slide-to-pptx`.

```
npm install -g @helping-ai-workflow/slide-to-pptx
```

## Usage

```
slide-to-pptx <slide-dir>                    # writes <basename>.pptx INTO <slide-dir>
slide-to-pptx <slide-dir> --page Cover       # only one page → <slide-dir>/Cover.pptx
slide-to-pptx <slide-dir> --out build        # write into ./build instead
slide-to-pptx <slide-dir> --ir               # also emit IR JSON sidecars
slide-to-pptx <slide-dir> --ir-only          # IR only, skip pptx
slide-to-pptx <slide-dir> --html             # dump per-page HTML for debug
slide-to-pptx --help
```

Default: every page in `<slide-dir>` → one `<slide-dir>/<slide-dir-basename>.pptx`, dropped
next to the slide source files. Override with `--out <dir>` if you'd rather keep build
artifacts elsewhere.

Playwright browser binaries are pulled in transitively; first run may take a moment while
Chromium downloads.

## Run from source (this repo)

```
npm install
npm run dev -- ../my-slide/slides/mac-merge-tx-spec
npm run dev -- ../my-slide/slides/mac-merge-tx-spec --page Cover
```

## How it works

1. `load-slide.ts` — esbuild-bundles the slide module (stubbing image imports and the
   `@open-slide/core` types-only package) and writes the bundle under `.cache/` so its
   `import 'react'` resolves to this project's React instance.
2. `extract.ts` — calls each `Page` function component to obtain a React element tree, then
   walks the tree. When a node's function component name is in the `PRIMITIVES` set
   (`Box`, `Arrow`, `PageHeading`, ...), the walker records its props *as-is* and stops
   descending. Otherwise it invokes the function and recurses. Host elements only
   contribute a translate from `style.position:absolute` `top`/`left`.
3. `pptx-build.ts` — one mapper per primitive kind. 1920×1080 canvas → 13.333×7.5 inch slide
   (144 px/inch). Web px → pt for font sizes is `× 0.75`.

## Known limits / next steps

* Only `Box`, `Arrow`, `PageHeading`, `FooterRule`, `FooterLabel`, `PageNum`,
  `AudienceChips` are mapped. `ParamRow`, `BitField`, `Gate`, `FSMNode` will fall through
  as placeholder boxes until mappers land.
* Walker only honours `position:absolute` with numeric `top`/`left`. `right`/`bottom`,
  flex/grid, transforms, and SVG-internal transforms beyond viewBox=size are ignored.
* `useState`/`useEffect` Pages are not supported — walker calls the function directly.
* Grid background is dropped; can be re-added as a slide master picture or as inline rects
  when needed.
* Fonts: emitted as `JetBrains Mono` / `Segoe UI` — Chinese fallback is up to PowerPoint.

## Layout

```
src/
  load-slide.ts       # esbuild bundle + dynamic import
  extract.ts          # element-tree walker → IR
  pptx-build.ts       # IR → pptxgenjs shapes
  cli.ts              # `slide-to-pptx spike <slide-dir>` entry
  types.ts
out/                  # .ir.json + .pptx (gitignored)
.cache/               # bundle cache (gitignored)
```
