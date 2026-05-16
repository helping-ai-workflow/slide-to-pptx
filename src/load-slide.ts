import { build, type Plugin } from 'esbuild';
import { writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CACHE_ROOT = path.join(PROJECT_ROOT, '.cache');

const pngStubPlugin: Plugin = {
  name: 'png-stub',
  setup(b) {
    b.onResolve({ filter: /\.(png|jpe?g|gif|webp|svg)$/ }, (args) => ({
      path: args.path,
      namespace: 'asset-stub',
    }));
    b.onLoad({ filter: /.*/, namespace: 'asset-stub' }, (args) => ({
      contents: `export default ${JSON.stringify(args.path)};`,
      loader: 'js',
    }));
  },
};

const openSlideStubPlugin: Plugin = {
  name: 'open-slide-stub',
  setup(b) {
    b.onResolve({ filter: /^@open-slide\/core$/ }, (args) => ({
      path: args.path,
      namespace: 'os-stub',
    }));
    b.onLoad({ filter: /.*/, namespace: 'os-stub' }, () => ({
      contents: `export {};`,
      loader: 'js',
    }));
  },
};

export type SlideModule = {
  default: Array<() => unknown>;
  meta?: { title?: string };
  design?: unknown;
};

export async function loadSlideModule(slideDir: string): Promise<SlideModule> {
  const entry = path.resolve(slideDir, 'index.tsx');
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    target: 'es2022',
    jsx: 'automatic',
    external: ['react', 'react-dom'],
    plugins: [pngStubPlugin, openSlideStubPlugin],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  await mkdir(CACHE_ROOT, { recursive: true });
  const dir = await mkdtemp(path.join(CACHE_ROOT, 'slide-bundle-'));
  const bundlePath = path.join(dir, 'slide.mjs');
  await writeFile(bundlePath, code, 'utf8');
  try {
    // Node caches the module in memory after import, so the bundle file
    // is safe to delete immediately. This keeps .cache/ from accumulating
    // a slide-bundle-XXXXXX directory per CLI invocation.
    return (await import(pathToFileURL(bundlePath).href)) as SlideModule;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
