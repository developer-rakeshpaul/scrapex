import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'parsers/index': 'src/parsers/index.ts',
    'llm/index': 'src/llm/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: ['@anthropic-ai/sdk', 'openai', 'puppeteer'],
  alias: {
    '@': resolve(__dirname, 'src'),
  },
});
