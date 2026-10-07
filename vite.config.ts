import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const REACT_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
];

/** In the single-file build React is loaded from a pinned CDN build before the game script. */
function reactFromCdn(): Plugin {
  return {
    name: 'react-from-cdn',
    transformIndexHtml(html) {
      const tags = REACT_CDN.map((src) => `<script src="${src}" crossorigin="anonymous"></script>`).join('\n    ');
      return html.replace('</head>', `    ${tags}\n  </head>`);
    },
  };
}

// `npm run build:single` produces one self-contained dist-single/index.html that
// can be opened from disk or published as a single page.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [react({ jsxRuntime: 'automatic' }), reactFromCdn(), viteSingleFile()] : [react()],
    resolve: single
      ? { alias: { 'react/jsx-runtime': fileURLToPath(new URL('./src/ui/jsx-shim.ts', import.meta.url)) } }
      : undefined,
    build: single
      ? {
          outDir: 'dist-single',
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
          },
        }
      : { outDir: 'dist' },
    test: { environment: 'node', include: ['test/**/*.test.ts'] },
  };
});
