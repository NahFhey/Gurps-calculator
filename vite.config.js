import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          // Keep stable third-party code out of the main shell chunk.
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons'
          }

          if (
            normalizedId.includes('/node_modules/dexie/') ||
            normalizedId.includes('/node_modules/immer/') ||
            normalizedId.includes('/node_modules/socket.io-client/')
          ) {
            return 'data-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  }
})
