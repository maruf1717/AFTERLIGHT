import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths so the build works from any sub-path (GitHub Pages, static hosting).
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Only the 3D libraries go to the «three» chunk: React and the store stay with the app,
        // so the interface starts without waiting for three.js (T4).
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react'
          if (/node_modules\/(react|react-dom|scheduler|zustand|use-sync-external-store)\//.test(id)) return 'react'
          // Post-processing (full graphics only) is its own chunk, loaded on demand.
          if (/node_modules\/(postprocessing|n8ao|@react-three\/postprocessing)\//.test(id)) return 'post'
          if (/node_modules\/(three|three-stdlib|@react-three|maath|camera-controls|troika|@monogrid|meshline|stats)/.test(id)) return 'three'
        },
      },
    },
  },
})
