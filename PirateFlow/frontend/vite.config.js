import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api': 'https://pirateflow.net'
    }
  },
  preview: {
    allowedHosts: ['pirateflow.net', 'www.pirateflow.net'],
    proxy: {
      '/api': 'https://pirateflow.net'
    }
  }
})
