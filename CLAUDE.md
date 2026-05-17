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
  measure-to-ir.ts       # measurements → IR tree
  pptx-build.ts          # IR → pptxgenjs
  pptx-postprocess.ts    # rewrite XML to wrap each component in p:grpSp
bin/slide-to-pptx.cjs    # CLI entrypoint (spawns tsx)
scripts/postinstall.cjs  # auto-install Chromium after npm install
.github/workflows/publish.yml  # tag → npm publish
```

## Typecheck

`npx tsc --noEmit` — repo has no test suite, so this is the only
mechanical gate. The publish workflow's `npm test` step is a no-op
(`node -e "console.log('no tests yet')"`).
