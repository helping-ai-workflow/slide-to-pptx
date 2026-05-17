#!/usr/bin/env node
'use strict';

// Auto-install Playwright Chromium after npm install so first run "just works".
// Skip when:
//   - SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD=1  (project-specific opt-out)
//   - PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1     (Playwright's standard opt-out)
//   - CI=true and SLIDE_TO_PPTX_INSTALL_IN_CI is not set
//
// Failures here are non-fatal — the runtime will surface a clearer message
// (see src/extract-pw.ts) if Chromium is missing when the CLI is invoked.

const { spawnSync } = require('child_process');
const path = require('path');

function shouldSkip() {
  if (process.env.SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD === '1') return 'SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD=1';
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') return 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1';
  if (process.env.CI === 'true' && !process.env.SLIDE_TO_PPTX_INSTALL_IN_CI) return 'CI=true (set SLIDE_TO_PPTX_INSTALL_IN_CI=1 to override)';
  return null;
}

const skipReason = shouldSkip();
if (skipReason) {
  console.log(`[slide-to-pptx] skipping Chromium download (${skipReason}).`);
  console.log(`[slide-to-pptx] run \`npx playwright install chromium\` manually before first use.`);
  process.exit(0);
}

let cliPath;
try {
  cliPath = require.resolve('playwright/cli');
} catch {
  // Older Playwright layout — fall back to the package's bin entry.
  try {
    const pkg = require('playwright/package.json');
    cliPath = path.join(path.dirname(require.resolve('playwright/package.json')), pkg.bin?.playwright || 'cli.js');
  } catch (e) {
    console.warn(`[slide-to-pptx] could not locate playwright CLI: ${e.message}`);
    console.warn(`[slide-to-pptx] run \`npx playwright install chromium\` manually before first use.`);
    process.exit(0);
  }
}

console.log(`[slide-to-pptx] downloading Chromium for Playwright (~130 MB; one-time)...`);
const r = spawnSync(process.execPath, [cliPath, 'install', 'chromium'], { stdio: 'inherit' });
if (r.status !== 0) {
  console.warn(`[slide-to-pptx] Chromium download exited with status ${r.status}.`);
  console.warn(`[slide-to-pptx] run \`npx playwright install chromium\` manually, or set SLIDE_TO_PPTX_SKIP_BROWSER_DOWNLOAD=1 to silence.`);
  // Never fail npm install over an optional browser download.
  process.exit(0);
}
