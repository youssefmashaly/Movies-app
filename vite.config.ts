import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Phase 53 — vendor chunk splitting.
      // Splitting large, rarely-changing third-party libraries into their own
      // named chunks means the browser can cache them independently of the
      // application code.  When only app code changes (the common case after
      // any feature commit), users re-download only the small app chunk and
      // the large vendor chunks remain cached.  This also dramatically
      // improves initial-load parse time on mobile because each chunk is
      // downloaded in parallel and parsed incrementally rather than one
      // giant sequential blob.
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Firebase Auth — ~155 KB raw, rarely changes.
            // Must match BOTH the thin `firebase` wrapper package AND the
            // `@firebase/*` scoped packages it re-exports from (app, auth,
            // component, util, etc.) — the actual SDK implementation lives
            // under `node_modules/@firebase/...`, which the original
            // `node_modules/firebase` substring check never matched (it
            // requires "firebase" immediately after "node_modules/", not
            // "@firebase"). That gap silently routed the entire Firebase
            // Auth implementation into vendor-misc instead of its own
            // cacheable chunk.
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            // Supabase client — ~200 KB raw, rarely changes
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            // Motion/Framer — ~135 KB raw, rarely changes
            if (id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }
            // React core — smallest but most critical; keep separate so
            // framework updates don't bust the app-code cache
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
            // Everything else in node_modules → generic vendor chunk
            if (id.includes('node_modules')) {
              return 'vendor-misc';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});