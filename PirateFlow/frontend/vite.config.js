export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  preview: {
    allowedHosts: ['pirateflow.net', 'www.pirateflow.net'],
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
<<<<<<< HEAD
})

=======
})
>>>>>>> benk-branch
