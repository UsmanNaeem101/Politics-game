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

const GOOGLE_FONTS = /\s*<link rel="preconnect"[^>]*>|\s*<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/g;
const LOCAL_FONTS = [
  '@fontsource/alegreya/400.css',
  '@fontsource/alegreya/400-italic.css',
  '@fontsource/alegreya/500.css',
  '@fontsource/alegreya/700.css',
  '@fontsource/alegreya-sans-sc/500.css',
  '@fontsource/alegreya-sans-sc/700.css',
  '@fontsource/grenze-gotisch/500.css',
  '@fontsource/grenze-gotisch/700.css',
];

/** The desktop app must run offline, so there its fonts come from the bundle rather than Google. */
function fonts(local: boolean): Plugin {
  return {
    name: 'fonts',
    resolveId: (id) => (id === 'virtual:fonts' ? '\0virtual:fonts' : null),
    load: (id) => (id === '\0virtual:fonts' ? (local ? LOCAL_FONTS.map((f) => `import '${f}';`).join('\n') : '') : null),
    transformIndexHtml: (html) => (local ? html.replace(GOOGLE_FONTS, '') : html),
  };
}

// `npm run build:single` produces one self-contained dist-single/index.html that
// can be opened from disk or published as a single page. `npm run build:desktop`
// produces dist-desktop/ for the Electron app (electron/main.cjs).
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const desktop = mode === 'desktop';
  return {
    base: './',
    plugins: single ? [react({ jsxRuntime: 'automatic' }), reactFromCdn(), viteSingleFile(), fonts(false)] : [react(), fonts(desktop)],
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
      : { outDir: desktop ? 'dist-desktop' : 'dist' },
    // The season tests play whole courts for months; give them room on slow machines.
    test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 20000 },
  };
});
