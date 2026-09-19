/**
 * Build the two halves of the plugin:
 * - `src/index.ts` -> `lib/index.js`  (Node, ESM, loaded by the host cordis loader)
 * - `src/client/index.ts` -> `lib/client.js` (browser, CJS body wrapped in the
 *   harness module-loader registration, so every bare `@deepseek-ai/*` and
 *   framework import is answered by the loader's module table at runtime)
 */
import { createRequire } from 'node:module'
import { defineConfig, type UserConfig } from 'tsdown'

const require = createRequire(import.meta.url)
const manifest = require('./package.json') as {
  name: string
  peerDependencies?: Record<string, string>
  dsh?: { client?: { inject?: string[] } }
}

/** Framework + shell packages the browser module table already provides. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const requested = new Set<string>([
  ...PLATFORM_MODULES,
  ...(manifest.dsh?.client?.inject ?? []),
  ...Object.keys(manifest.peerDependencies ?? {}),
])

const isRequested = (specifier: string) => requested.has(specifier)
const isNodeBuiltin = (specifier: string) => specifier === 'node:process' || /^(node:[a-z_]+$|^fs$|^path$|^os$|^child_process$|^url$|^util$|^events$|^stream$|^buffer$)/.test(specifier)

const clientExternals = (specifier: string) => isRequested(specifier) || specifier.startsWith('@deepseek-ai/')

const host: UserConfig = {
  name: `${manifest.name}/host`,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: (specifier) => isNodeBuiltin(specifier) || clientExternals(specifier),
    alwaysBundle: (specifier) => !(isNodeBuiltin(specifier) || clientExternals(specifier)),
  },
  // package.json `main`/`exports` name `lib/index.js`; rolldown would emit `.mjs`.
  outputOptions: { entryFileNames: 'index.js' },
}

const client: UserConfig = {
  name: `${manifest.name}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  dts: false,
  sourcemap: false,
  // Both configs write lib/; the host half owns the clean (see the build script).
  clean: false,
  deps: {
    neverBundle: clientExternals,
    alwaysBundle: (specifier) => !clientExternals(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: (chunk: { isEntry?: boolean; fileName?: string }) =>
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, `
      + `${chunk.isEntry ? '' : `chunk: ${JSON.stringify(chunk.fileName)}, `}factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([host, client])
