import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The FastAPI backend runs on :8000. During development, /api is proxied to it.
const API_TARGET = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173, proxy: { '/api': { target: API_TARGET, changeOrigin: true } } },
  preview: { port: 4173, proxy: { '/api': { target: API_TARGET, changeOrigin: true } } },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
