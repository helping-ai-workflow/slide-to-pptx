# slide-to-pptx

Convert `open-slide` React decks into editable PowerPoint (`.pptx`) — native shapes, lines, and text frames, not rasterised images.

```
npm install -g @helping-ai-workflow/slide-to-pptx
slide-to-pptx path/to/your/slide-dir
# → path/to/your/slide-dir/<basename>.pptx
```

Every shape and text run that goes into the .pptx remains selectable, editable, and grouped exactly the way the React source declares it. No bitmap fallback, no "render the whole slide as one PNG" trick — the file you open in PowerPoint is the file your audience can also edit.

## Why

`open-slide` is a beautiful authoring surface — the declarative `Box` / `Arrow` / `PageHeading` / `BitField` / ... primitives map cleanly onto how engineers think about diagrams. But many corporate review workflows still demand `.pptx` deliverables (Teams, SharePoint, legal review, customer hand-off). This tool exists so you can keep authoring in React but ship `.pptx`.

## Install

```
npm install -g @helping-ai-workflow/slide-to-pptx
```

Playwright is a transitive dependency; the first run downloads a headless Chromium (≈ 130 MB) into the package's install directory. Subsequent runs reuse it.

Requires Node ≥ 18.

## Usage

```
slide-to-pptx <slide-dir>                    # default: writes <basename>.pptx into <slide-dir>
slide-to-pptx <slide-dir> --page Cover       # build a single page → <slide-dir>/Cover.pptx
slide-to-pptx <slide-dir> --out build        # redirect output to ./build/
slide-to-pptx <slide-dir> --ir               # also emit per-page IR JSON sidecars
slide-to-pptx <slide-dir> --ir-only          # IR only, skip the .pptx
slide-to-pptx <slide-dir> --html             # dump per-page HTML for debugging, skip the .pptx
slide-to-pptx <slide-dir> -q                 # suppress progress output (errors still go to stderr)
slide-to-pptx --help
```

`<slide-dir>` must contain an `index.tsx` whose `default` export is an array of React Page components — that is, any open-slide-shaped project, including the examples in the `open-slide` repo itself.

Output filename = the slide directory's basename, with `[^\w.-]` collapsed to `_`. Pass `--out <dir>` to keep build artefacts out of the source tree.

## What you get

* **Editable native shapes.** Every `Box`, `Arrow`, divider, badge, rounded card, table cell, BitField segment, FSM node, etc. comes out as a real PowerPoint shape with the same fill, stroke, dash style, and corner radius. Move it, resize it, recolour it — PowerPoint treats it as a first-class object.
* **Real text frames.** Rich runs preserve weight, italic, colour, and monospace fallback per character. CJK text round-trips correctly. Verbatim literals (e.g. hex bytes like `0xE6`) are never silently coerced.
* **Component grouping.** Each open-slide component instance becomes a PowerPoint group (`p:grpSp`), so selecting a `Box` selects the rect *and* its label together — exactly how the React tree was authored.
* **Native lines + arrowheads.** Connectors are real `line` shapes with arrowheads, not vector traces, so PowerPoint's reflow keeps them attached when you nudge an endpoint.
* **Decor + shadows.** Borders, per-corner radii, and box shadows render via PowerPoint's effect stack.

## Architecture

```
slide React tree
  → load-slide.ts        # esbuild-bundle index.tsx (stubs image / @open-slide/core imports)
  → instrument.tsx       # tag each PRIMITIVE root with data-prim-id so the DOM is traceable
  → render-html.ts       # renderToStaticMarkup → standalone HTML per page (assets inlined as data:)
  → extract-pw.ts        # headless Chromium measures the laid-out DOM (rect, text runs, SVG, decor)
  → measure-to-ir.ts     # measurements → IR (Shape | RichText | Image | Decor | Group), tree-shaped
  → pptx-build.ts        # IR → pptxgenjs (native shapes, lines, text frames, images)
  → pptx-postprocess.ts  # rewrite XML to wrap each component's shapes in p:grpSp
  → .pptx
```

The headless-DOM approach means we **don't have to recognise every primitive by name** — anything that React renders to HTML/SVG with computed styles, we can measure and emit. New open-slide primitives land for free if they're built on standard layout.

A 1920×1080 canvas maps to PowerPoint's 13.333 × 7.5 inch slide (144 px/inch). Font sizes convert at `× 0.75` (web px → pt).

## Limitations

* `useState` / `useEffect` Pages aren't supported — the renderer evaluates each Page once at SSR time, so anything that depends on a real React lifecycle won't render.
* CSS that depends on actual browser viewport (`vw`/`vh`/media queries) is evaluated at 1920×1080.
* PowerPoint's font fallback is up to the user's installed fonts; JetBrains Mono / Segoe UI / Cascadia are the defaults emitted.
* `position: absolute` with `right` / `bottom` and CSS Grid/Flex *are* handled because measurement happens in real Chromium, but extremely dynamic layouts (transitions, animations) are sampled at SSR time only.
* Slide masters / templates / per-deck themes aren't preserved — each slide is emitted as a flat page with the design tokens flattened into shape attributes.

## Develop locally

```
git clone https://github.com/helping-ai-workflow/slide-to-pptx
cd slide-to-pptx
npm install
npm run dev -- ../path/to/open-slide/slides/<deck>
npm run dev -- ../path/to/open-slide/slides/<deck> --page Cover
```

`src/` layout:

```
cli.ts              # arg parsing, orchestration
env.ts              # set NODE_ENV=production so React skips dev warnings
load-slide.ts       # esbuild bundle + dynamic import (cleans .cache/ per run)
instrument.tsx      # tag PRIMITIVE roots with data-prim-id
render-html.ts      # React SSR → standalone HTML per page
extract-pw.ts       # Playwright-driven DOM measurement
measure-to-ir.ts    # measurements → IR tree
pptx-build.ts       # IR → pptxgenjs shapes
pptx-postprocess.ts # rewrite pptx XML for component grouping
types.ts            # IR types
```

## Contributing

Issues and PRs welcome. The smallest useful contribution: drop your own slide deck (or a minimal repro of one that doesn't render correctly) into an issue — the IR-emit path is the easiest place to add coverage for unusual layouts.

Publishing to npm is automated: pushing a `v*.*.*` tag triggers `.github/workflows/publish.yml`, which runs `npm publish --access public` under the `@helping-ai-workflow` scope.

## License

MIT — see [LICENSE](./LICENSE).

`open-slide` is the work of Yiwei. This project is an independent exporter, not affiliated with the open-slide maintainers.
