import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
