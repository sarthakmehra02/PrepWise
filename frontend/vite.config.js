import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@vapi-ai/web'],
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
              return 'monaco';
            }
            if (id.includes('pdfjs-dist')) {
              return 'pdf-lib';
            }
            if (
              id.includes('react') ||
              id.includes('firebase')
            ) {
              return 'vendor';
            }
          }
        }
      }
    }
  },
  worker: {
    format: 'es',
  },
})
