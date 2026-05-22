# slide-to-pptx — repo notes for Claude

## What this is

npm package (`@helping-ai-workflow/slide-to-pptx`) that renders open-slide
React decks → editable `.pptx` via Playwright + pptxgenjs.

**Not a Claude Code plugin.** No `.claude-plugin/`, no marketplace. The
plugin release shortcut in `~/.claude/CLAUDE.md` ("OK 更新 plugin")
does not apply here — see "Release flow" below.

## Release flow

GitHub Actions auto-publishes to npm on any pushed `v*.*.*` tag
(`.github/workflows/publish.yml`). The publisher side does not run
`postinstall`, so the workflow itself is fast (~10s).

### Pre-release visual check

Before bumping the version, run:

```bash
npm run pre-release
```

This drives PowerPoint COM to render every corpus deck (4 dev decks at
`/home/user/hp_workspace/my-slide/slides/` + 4 stress fixtures under
`tests/fixtures/stress/`) and pixel-diffs each page against the HTML
snapshot ground truth. Any page above the 5% pixel-diff threshold fails
the script.

Investigate failures before releasing — silent visual regressions are
the class of bug this harness exists to catch. Diff PNGs are written to
`/mnt/c/Users/Joe96/Downloads/pptx-render/vr/<deck>/out/diff-NN.png`
for visual triage. The JSON summary lives at
`docs/visual-regression-baseline.json` (gitignored — the harness
overwrites it each run).

Requires WSL + Microsoft PowerPoint installed at the documented path.
Not available in non-WSL environments; in that case the harness exits 2
and the release flow must verify visually some other way (e.g. open the
pptx manually).

Steps for a release:

1. Land non-release commit(s) on `main` (e.g. `fix: ...`, `feat: ...`).
2. Separate `release: vX.Y.Z` commit that only touches:
   - `package.json` `version` field
   - `package-lock.json` (run `npm install --package-lock-only --ignore-scripts`)
3. `git push origin main`
4. `git tag -a vX.Y.Z -m "Release vX.Y.Z" <release-sha>`
5. `git push origin vX.Y.Z` — this triggers the workflow.
6. `gh run watch <run-id> --exit-status` to confirm publish succeeded.

History convention (verified via `git log`): release commits are titled
exactly `release: vX.Y.Z` with no body, and ONLY bump version + lockfile.
Bundling code changes into the release commit breaks the pattern.

## Development workflow

Multi-bug or multi-feature work uses a plan-driven, subagent-driven loop.
One-off small fixes (typo, single-function tweak) skip this and go straight
to a feature branch + PR.

### When to write a plan

Use `superpowers:writing-plans` (and the optional brainstorming/handoff
companions) when the work fits any of these:

- 2+ independent bug clusters or feature additions.
- An investigation step is needed before the fix is obvious.
- The user is going to hand work off to a fresh session (handoff prompt).

Plans live at `docs/superpowers/plans/YYYY-MM-DD-plan-X-slug.md`. Brainstorm
notes and handoff prompts live in sibling dirs under `docs/superpowers/`.
**These files are never committed** (global rule in `~/.claude/CLAUDE.md`).
They are local working state — implementation lands in code, not in
plan/spec markdown.

### Plan structure

Each task in the plan should specify:

- Acceptance criterion measurable from the harness (e.g. "diff% < 5% on
  pages X/Y/Z, no other deck regression"), not just "the bug is fixed".
- Hypothesis class + likely files to investigate.
- Branch name: `feat/plan-X-N-slug` (new behavior) or `fix/plan-X-N-slug`
  (bug fix). N = task number within the plan.
- "Stop at PR opened" — the implementer must NOT merge; the controller
  reviews first.

### Per-task subagent loop

`superpowers:subagent-driven-development` orchestrates one task at a time:

1. **Implementer subagent** — fresh context per task. Creates branch,
   investigates, fixes surgically, runs `npm test` + `npx tsc --noEmit`
   + visual verify, commits, pushes, opens PR. **Stops before merge.**
2. **Spec compliance reviewer** — confirms the goal was met. If the
   implementer's actual root cause differed from the hypothesis, that is
   fine *as long as the goal is met and scope stayed surgical*. Plan H1
   hypothesized "table-cell text duplication" but the real cause was
   "CSS gradient background dropped"; reviewer accepted because diff%
   target was hit.
3. **Code quality reviewer** — runs only after spec review passes. Flags
   bugs in the new code path (not just style nits). Critical/Important
   findings go back to the implementer on the same branch as a follow-up
   commit. Re-review until clean.
4. **Controller merges** with `gh pr merge <pr> --merge --delete-branch`.
   `--merge` (not `--squash`) keeps per-commit history. After merge:
   `git checkout main && git pull --ff-only`.

Run spec and quality reviewers in parallel when neither needs to write
code (both are read-only). Send fixes back to the original implementer
subagent via `SendMessage` so the implementer keeps full context.

### Two-gate validation (pre-release + post-release)

`npm run pre-release` runs TWO independent pixel-diff gates. Both must be
green before tagging a release. The gates examine different layers of the
pipeline and catch different bug classes — a whole-image diff cannot detect
structural duplication with low pixel footprint (Plan K root cause), so a
per-primimg diff is added alongside it.

| Aspect | Gate 1 (pre-release) | Gate 2 (post-release) |
|---|---|---|
| Comparison target | HTML snapshot (Chromium ground truth) | fresh isolated re-render of source primitive |
| Comparison input | PowerPoint-exported pptx PNG | embedded fallback PNG inside pptx |
| Layer | end-to-end | mid-pipeline |
| Default threshold | 5% per-page | 1% per-primimg |
| Override file | `docs/visual-regression-thresholds.json` `.overrides` | same file, `.postRelease.overrides` |
| Catches | whole-slide visual drift | sibling-bake / structural duplication |
| Misses | low-footprint structural duplicates | end-to-end issues that don't go through a primimg |
| Runtime cost | ~3-5 min (PowerPoint COM) | ~10 s (Playwright re-render) |

Plan K's spec captures the per-pixel arithmetic that proves Gate 1 alone
cannot catch the duplicated-text class of bug (3.98% diff on
`getting-started` Cover with 10 duplicated titles is below the 5%
threshold — but the title visibly renders twice in PowerPoint).

### Visual verification is a developer-side check, not a gate

`npm test` and `npx tsc --noEmit` verify code correctness, not feature
correctness. They CANNOT detect a visual regression. The two pixel-diff
gates above are the automated replacement.

When iterating on a fix during development:

- Read the relevant `diff-NN.png` with the Read tool. The agent is
  multimodal; red pixels in the diff PNG are the only authoritative
  signal that the user-visible result changed in the right direction.
- "Editability 100%" and "fidelity.json fallbacks: []" are NOT proxies
  for "looks right". Several pre-Plan-H releases shipped with the test
  suite green but visually broken — the user caught them by opening the
  pptx in PowerPoint. The visual-regression harness exists so the agent
  can catch them first.

Opening the pptx in PowerPoint manually is useful for fast iteration but
is NOT the gate — the gate is `npm run pre-release` returning exit 0
with both sections green. Plan K shipped v0.3.2 with both `npm test` AND
Gate 1 passing, but a duplicated-text bug visible in PowerPoint. Gate 2
is the quantified replacement for "human eyeball at release time".

### Test/tsc gates

- `npm test` — current baseline 63/63 (28 after Plan H2, 28 → 44 with
  Plan I's 16 classifier tests in `tests/shape-classify.test.ts`,
  44 → 57 with Plan J's 13 custGeom-builder tests in
  `tests/custgeom.test.ts`, 57 → 63 with Plan K's 6 helper tests in
  `tests/post-release-check.test.ts`). Implementers update this count
  when they add tests; reviewers verify the count claim.
- `npx tsc --noEmit` — must be clean.
- `npm run pre-release` — runs Gate 1 (per-page) then Gate 2 (per-primimg)
  in one invocation. ~3-5 min for Gate 1 via PowerPoint COM + ~10 s for
  Gate 2 via Playwright. Required before tagging a release; recommended
  after any change touching the IR / extraction / postprocess /
  primitive-screenshot paths.

### PR conventions

- Title format: `<type>: <subject> (Plan X<N>)` where `<type>` is
  `fix` / `feat` / `refactor` / `test` / `docs` / `chore`, and `(Plan
  X<N>)` is included when the work is part of a plan (e.g. `(Plan H1)`).
- Title ≤ 70 chars.
- Body: Summary (root cause), Test plan (before/after diff% if visual,
  `npm test` count, tsc result), reference to the plan file path.
- Branch deleted automatically by `--delete-branch` on merge.

### Hard rules (no exceptions even with `OK 更新 plugin` shortcut)

- No commits directly to `main`.
- No `--no-verify`, `--no-gpg-sign`, or `--admin` merge.
- No force push to `main` or `master`.
- No `--squash` (history convention is `--merge`).
- No plan/spec docs committed under `docs/superpowers/{plans,specs}/`.
- Release commit only touches `package.json` + `package-lock.json`; never
  bundle code changes into a `release: vX.Y.Z` commit.

### CLAUDE.md is part of plan completion

After every plan merges, before tagging the release, the controller MUST
update CLAUDE.md to reflect anything that changed:

- New source files → "Layout" section.
- New module-level invariants or principles → relevant principle section.
- Test count baseline (`npm test` N/N) → "Test/tsc gates".
- Permanent process refinements discovered during the plan → "Development
  workflow" or "Hard rules".

This is a gate, not a nice-to-have. CLAUDE.md is what bootstraps the next
session — a stale CLAUDE.md silently de-skills every future agent. Plan I
shipped to npm before this rule existed and CLAUDE.md was left stale; the
user caught it. Don't repeat.

The CLAUDE.md update itself follows the same flow as any other change —
feature branch, PR (title `docs(CLAUDE): <subject> (Plan X aftermath)`),
review, `--merge --delete-branch`. It is NOT a release commit and is NOT
bundled into the `release: vX.Y.Z` commit.

## Playwright Chromium

`scripts/postinstall.cjs` runs after `npm install` and downloads Chromium
into `~/.cache/ms-playwright` so the CLI works on first invocation.

Opt-outs (any one triggers skip + manual-install hint):

- `SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD=1`
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- `CI=true` (unless `SLIDE_TO_PPTX_INSTALL_IN_CI=1` is set)

Manual fallback: `npx playwright install chromium`.

The runtime (`src/extract-pw.ts` `measureSlide`) wraps `chromium.launch()`
so a missing browser produces the same hint instead of Playwright's raw
"Executable doesn't exist" trace.

## Layout

```
src/
  cli.ts                 # arg parse + orchestration
  load-slide.ts          # esbuild bundle index.tsx (stub @open-slide/core)
  instrument.tsx         # tag primitive roots with data-prim-id
  render-html.ts         # renderToStaticMarkup → standalone HTML per page
  extract-pw.ts          # headless Chromium measure (rect, text, SVG, decor)
  shape-classify.ts      # pure point-list → line / rect / polyline classifier
  custgeom.ts            # pure builder for <a:custGeom> OOXML AST node
  measure-to-ir.ts       # measurements → IR tree
  pptx-build.ts          # IR → pptxgenjs (curves emit as __cust__N__ placeholders, primimg shapes get primimg:<srcPrimId>: name prefix)
  pptx-postprocess.ts    # rewrite XML — group p:grpSp, swap __cust__ placeholders to custGeom, CJK font
bin/slide-to-pptx.cjs    # CLI entrypoint (spawns tsx)
scripts/postinstall.cjs        # auto-install Chromium after npm install
scripts/visual-regression.mjs  # Gate 1 (per-page) + invokes Gate 2 (per-primimg)
scripts/post-release-check.mjs # Gate 2: parse pptx, re-render isolated primitive, pixel-diff
.github/workflows/publish.yml  # tag → npm publish
```

## Typecheck

`npx tsc --noEmit` is one of the mechanical gates. Unit tests
(`npm test`, currently 63 / 63 via `node:test`) are the other. The publish
workflow's `npm test` step is a no-op stub — actual test enforcement
happens in the dev loop (see "Development workflow" → "Test/tsc gates").

## Design principle: trust the browser, don't reimplement it

The plugin's job is to **transcribe** what the browser already laid out
into a pptx, not to **recompute** the layout. Every time the plugin
reimplements something the browser already does, it ships a class of
bugs that surface deck-by-deck (missing CSS feature, missing SVG path
command, missing transform, missing viewBox, etc.).

Concrete rules when extracting from the DOM in `src/extract-pw.ts` (the
Playwright `page.evaluate` script):

| Asking for | Use | NOT |
|---|---|---|
| Element screen position / size | `el.getBoundingClientRect()` | computed from attributes |
| Computed style (color, font, padding…) | `getComputedStyle(el)` | parsing CSS strings yourself |
| SVG path geometry as polyline | `el.getTotalLength()` + `el.getPointAtLength(t)` + `pt.matrixTransform(el.getScreenCTM())` | hand-rolled parser of `d="..."` |
| SVG primitive (line / polyline / rect endpoint) in screen space | `el.createSVGPoint(); pt.x=…; pt.matrixTransform(el.getScreenCTM())` | `svgRect.left + x1` (ignores viewBox + parent transforms) |
| DOM parent / ancestor / sibling | `el.closest(...)`, `el.parentElement`, `el.children` | manual tree walk |

**Why this matters.** The browser already executed every CSS rule, every
SVG `viewBox`, every `<g transform="...">`, every CSS `transform: ...`,
every parent matrix. Asking the browser is correct by construction. The
moment the plugin starts parsing attribute strings to recompute a
coordinate, the result drifts from what the user sees in Chromium.

**Pattern to avoid: "parse the attribute, do the math".** If you find
yourself writing a regex over a CSS-spec or SVG-spec string in order to
derive a geometric quantity, stop. The browser exposes an API for it.
Examples from past Plan B-D bugs:

- Plan B implemented `parsePathD` to parse `<path d="...">` into line
  segments. Plan D extended it to support A/S/T commands. Both worked
  for paths with positive coordinates, but silently mis-rendered paths
  with negative coordinates because the math added `svgRect.left + x`
  while the actual screen position required a viewBox-aware transform.
  Plan E replaced the whole parser with `getPointAtLength` +
  `getScreenCTM` — one helper, all SVG path commands handled, every
  viewBox / parent-transform case correct.

**Acceptable exceptions.** Parsing CSS strings for non-geometric
properties is fine: colors (`rgb(...)` → hex), shadow specs, gradient
stops. The browser exposes these only as serialized strings, so parsing
is the only path. The line is: parsing for **representation conversion**
is OK; parsing to **redo geometry** is not.

**When in doubt:** if the answer to "could the browser compute this
directly?" is yes, use the browser API.

### Corollary: classification vs geometry

There IS a legitimate kind of attribute-string inspection: reading the
command-LETTER stream from `<path d="...">` to decide whether a path is
linear-only (M/L/H/V/Z) or contains curves (C/S/Q/T/A). That is
classification, not geometry — the letters are the path's TYPE, not its
shape. Once the type is known, the actual coordinates STILL come from
`getPointAtLength` + `getScreenCTM`. The split:

| Inspecting `d` for... | OK? | Why |
|---|---|---|
| Command letters (regex `/[a-zA-Z]/g`) | yes | type classification, never geometry |
| Coordinate numbers (any `parseFloat` of `d`) | NO | the browser already resolved them under the viewBox + ancestor transforms; redoing the math drifts |
| Counting subpaths via `M` letter occurrences | yes | structural, not positional |

Plan I uses this split: linear-only `<path>` collapses to ONE pptx shape
(line / rect via `src/shape-classify.ts`); curved paths keep the previous
N-segment sampling because pptxgenjs has no `custGeom` API. The classifier
itself is pure and works only on screen-space `{x, y}` points the browser
has already produced.

### Curves: ONE shape via `<a:custGeom>` (Plan J)

Curved `<path>` elements (any `C/S/Q/T/A` command) emit as ONE PowerPoint
shape via OOXML `<a:custGeom>`, polyline-approximated at the same sampling
density as v0.3.1 (16–256 points via `getPointAtLength`). pptxgenjs has no
`custGeom` API, so the pipeline uses a placeholder strategy:

1. `src/extract-pw.ts` curved-path branch emits ONE `tag:'curvePath'`
   svgShape carrying the full screen-space sample list + style metadata.
2. `src/measure-to-ir.ts` routes it to a `kind: 'CurvePath'` IR item.
3. `src/pptx-build.ts` emits each `CurvePath` as a placeholder rect via
   `addShape('rect', { objectName: '__cust__N__...' })` and accumulates
   `CustGeomSpec[]` per slide. `buildPptx` returns the spec table.
4. `src/cli.ts` threads `customGeomsPerSlide` into `postprocessPptx`.
5. `src/pptx-postprocess.ts` finds shapes by `__cust__N__` name prefix,
   strips the prefix, keeps the `<a:xfrm>`, and replaces the geometry +
   line + fill children with `<a:custGeom>` + `<a:ln>` + `<a:solidFill>`
   built by `src/custgeom.ts`. The rewrite runs BEFORE `processSpTree`
   so the renamed curves participate in primitive grouping with siblings.

OOXML conventions confirmed against pptxgenjs's own emission:
- End-arrow uses `<a:tailEnd type="triangle"/>` (NOT `<a:headEnd>` —
  pptxgenjs maps `endArrowType` to `tailEnd`; the convention is locked
  in by `tests/custgeom.test.ts`).
- When stroke is absent, omit `<a:ln>` entirely (don't emit
  `<a:ln w="N"><a:noFill/></a:ln>`).
- `<a:path>` coordinates are local 0..100000; world-space lives in
  `<a:xfrm>`.

### Deferred: true cubic-bezier control points

Plan J's polyline approximation is pixel-identical to v0.3.1 (same
samples, just wrapped as ONE shape). A future plan could read actual
cubic / quadratic control points via `SVGGeometryElement.getPathData()`
and emit `<a:cubicBezTo>` / `<a:quadBezTo>` for a vector-perfect curve.
Visual gain is zero on the current corpus (the polyline is already at
8-px sampling — well below diff-detection); editability gain is minor
(curves are ALREADY one shape now). Lower priority — file when needed.

## Visual verification: pptx → PNG via Windows PowerPoint (WSL)

Env is WSL with Microsoft PowerPoint installed at
`/mnt/c/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE`.
LibreOffice is **not** installed and `sudo apt-get install` is blocked
by the agent classifier. To verify pptx output visually, drive PowerPoint
via COM from a VBScript launched with `cscript.exe`.

PowerShell `-File` with `-ExecutionPolicy Bypass` is also blocked by the
classifier (Security-Weaken trigger). VBS path avoids that.

Recipe (one-shot, both decks):

1. Stage pptx files on the Windows side (anywhere under `/mnt/c/...`).
   The script needs Windows-native paths.
2. Drop this VBS somewhere accessible to both sides:

```vbs
' usage: cscript //nologo render.vbs <pptx-win-path> <outdir-win-path>
Set args = WScript.Arguments
pptxPath = args(0) : outDir = args(1)
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FolderExists(outDir) Then fso.CreateFolder outDir
Set ppt = CreateObject("PowerPoint.Application")
ppt.Visible = True
Set pres = ppt.Presentations.Open(pptxPath, True, True, False)
i = 0
For Each slide In pres.Slides
    i = i + 1
    slide.Export outDir & "\" & Right("0" & i, 2) & ".png", "PNG", 1920, 1080
Next
pres.Close
ppt.Quit
```

3. Invoke from WSL:

```bash
cscript.exe //nologo "C:\path\to\render.vbs" \
  "C:\path\to\deck.pptx" "C:\path\to\outdir"
```

`Presentations.Open(path, ReadOnly=True, Untitled=True, WithWindow=False)`
keeps the file untouched on disk. `Visible=True` is required for
`Slide.Export` to work; setting it to False makes Export fail silently
in some Office builds.

Read resulting PNGs with the Read tool from `/mnt/c/...` paths —
multimodal preview lets the agent eyeball wrap, overlap, alignment.

Pair with the HTML-PNG render of the same deck (`--html` then a
Playwright `setContent` + `page.screenshot` loop) to diff "what the
browser drew" vs "what PowerPoint drew". Plugin defects almost always
show up as a delta between the two.
