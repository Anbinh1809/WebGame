import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Loopback hosting keeps local browser smoke tests deterministic.
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => id.includes('node_modules/three/') ? 'three' : undefined,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
