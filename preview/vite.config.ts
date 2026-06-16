import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src/renderer'),
      '@shared': resolve(__dirname, '../src/shared')
    }
  },
  plugins: [react()],
  server: { port: 5188 }
})
